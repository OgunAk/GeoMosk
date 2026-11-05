using System.Text.Json;
using GeoScope.Api.Http;
using GeoScope.Application.Features;
using GeoScope.Application.UserFeatures;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Options;

namespace GeoScope.Api.Controllers;

/// <summary>
/// Kullanıcı çizimleri katmanı (C02-C04): Point, LineString (polyline), Polygon; EPSG:4326.
/// Kaynak (OSM) katmanlarından ayrı tabloda tutulur. Güncelleme/silme If-Match ile korunur.
/// </summary>
[ApiController]
[Route("api/features")]
public sealed class UserFeaturesController(IUserFeatureStore store, IOptions<FeatureListOptions> options) : ControllerBase
{
    private const string GeoJson = "application/geo+json";

    /// <summary>Kullanıcı çizimleri; oluşturma zamanına göre sıralı.</summary>
    [HttpGet]
    [ProducesResponseType<GeoJsonFeatureCollection>(StatusCodes.Status200OK, GeoJson)]
    [ProducesResponseType<ValidationProblemDetails>(StatusCodes.Status400BadRequest, "application/problem+json")]
    public async Task<IActionResult> List(string? bbox, string? q, int? limit, int? offset, CancellationToken cancellationToken)
    {
        var (query, errors) = FeatureQueryParser.Parse(new FeatureListRequest(bbox, limit, offset, q), options.Value);
        if (query is null) return Validation(new RequestErrors(errors, false));
        return new ObjectResult(await store.ListAsync(query, cancellationToken)) { ContentTypes = { GeoJson } };
    }

    [HttpGet("{id:guid}")]
    [ProducesResponseType<GeoJsonFeature>(StatusCodes.Status200OK, GeoJson)]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status404NotFound, "application/problem+json")]
    public async Task<IActionResult> Get(Guid id, CancellationToken cancellationToken)
    {
        var feature = await store.GetAsync(id, cancellationToken);
        return feature is null ? NotFoundProblem() : FeatureResult(feature);
    }

    /// <summary>
    /// Yeni çizim. Gövde RFC 7946 Feature: <c>{"type":"Feature","geometry":{…},"properties":{"name":"…","description"?:"…"}}</c>.
    /// Biçim hatası 400; geçersiz/desteklenmeyen geometri, çalışma alanı dışı veya fazla köşe 422.
    /// </summary>
    [HttpPost]
    [Consumes("application/json", "application/geo+json")]
    [ProducesResponseType<GeoJsonFeature>(StatusCodes.Status201Created, GeoJson)]
    [ProducesResponseType<ValidationProblemDetails>(StatusCodes.Status400BadRequest, "application/problem+json")]
    [ProducesResponseType<ValidationProblemDetails>(StatusCodes.Status422UnprocessableEntity, "application/problem+json")]
    public async Task<IActionResult> Create([FromBody] JsonElement body, CancellationToken cancellationToken)
    {
        var (request, errors) = UserFeatureRequestParser.ParseCreate(body);
        if (request is null) return Validation(errors);

        var result = await store.CreateAsync(request, cancellationToken);
        if (result.Status == UserFeatureWriteStatus.GeometryRejected) return GeometryRejectedProblem();
        var created = result.Feature!;
        Response.Headers.ETag = ETags.Format(created.Version);
        return new CreatedResult($"/api/features/{created.Feature.Id}", created.Feature) { ContentTypes = { GeoJson } };
    }

    /// <summary>
    /// Ad, açıklama ve/veya geometri güncelleme (tek işlemde). Gövde: <c>{"name"?, "description"?, "geometry"?}</c>;
    /// gönderilmeyen alan değişmez, <c>description: null</c> temizler. <c>If-Match</c> zorunlu.
    /// </summary>
    [HttpPatch("{id:guid}")]
    [Consumes("application/json")]
    [ProducesResponseType<GeoJsonFeature>(StatusCodes.Status200OK, GeoJson)]
    [ProducesResponseType<ValidationProblemDetails>(StatusCodes.Status400BadRequest, "application/problem+json")]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status404NotFound, "application/problem+json")]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status412PreconditionFailed, "application/problem+json")]
    [ProducesResponseType<ValidationProblemDetails>(StatusCodes.Status422UnprocessableEntity, "application/problem+json")]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status428PreconditionRequired, "application/problem+json")]
    public async Task<IActionResult> Update(Guid id, [FromBody] JsonElement body, CancellationToken cancellationToken)
    {
        if (IfMatchProblem(out var expected) is { } problem) return problem;
        var (patch, errors) = UserFeatureRequestParser.ParsePatch(body);
        if (patch is null) return Validation(errors);

        var result = await store.UpdateAsync(id, patch, expected, cancellationToken);
        return result.Status switch
        {
            UserFeatureWriteStatus.NotFound => NotFoundProblem(),
            UserFeatureWriteStatus.VersionMismatch => ConflictProblem(),
            UserFeatureWriteStatus.GeometryRejected => GeometryRejectedProblem(),
            _ => FeatureResult(result.Feature!),
        };
    }

    /// <summary>Çizimi siler. <c>If-Match</c> zorunlu: başkasının araya giren değişikliği habersiz silinmez.</summary>
    [HttpDelete("{id:guid}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status404NotFound, "application/problem+json")]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status412PreconditionFailed, "application/problem+json")]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status428PreconditionRequired, "application/problem+json")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken cancellationToken)
    {
        if (IfMatchProblem(out var expected) is { } problem) return problem;
        return await store.DeleteAsync(id, expected, cancellationToken) switch
        {
            UserFeatureWriteStatus.NotFound => NotFoundProblem(),
            UserFeatureWriteStatus.VersionMismatch => ConflictProblem(),
            _ => NoContent(),
        };
    }

    private IActionResult GeometryRejectedProblem()
    {
        ModelState.AddModelError("geometry", "Geçersiz geometri: veritabanı geometri doğrulaması reddetti (kendini kesen veya bozuk şekil). Kayıt değişmedi.");
        return ValidationProblem(statusCode: StatusCodes.Status422UnprocessableEntity, modelStateDictionary: ModelState);
    }

    private IActionResult FeatureResult(VersionedFeature feature)
    {
        Response.Headers.ETag = ETags.Format(feature.Version);
        return new ObjectResult(feature.Feature) { ContentTypes = { GeoJson } };
    }

    private IActionResult? IfMatchProblem(out uint expected)
    {
        if (ETags.TryParseIfMatch(Request.Headers.IfMatch, out expected, out var missing)) return null;
        return missing
            ? Problem(statusCode: StatusCodes.Status428PreconditionRequired, title: "If-Match başlığı gerekli.",
                detail: "Kayıp güncellemeyi önlemek için GET yanıtındaki ETag değerini If-Match ile gönderin.")
            : Problem(statusCode: StatusCodes.Status400BadRequest, title: "If-Match biçimi geçersiz.");
    }

    private IActionResult NotFoundProblem() =>
        Problem(statusCode: StatusCodes.Status404NotFound, title: "Çizim bulunamadı (silinmiş olabilir).");

    private IActionResult ConflictProblem() =>
        Problem(statusCode: StatusCodes.Status412PreconditionFailed, title: "Kayıt bu arada değişti.",
            detail: "Güncel kaydı yeniden yükleyip tekrar deneyin.");

    private IActionResult Validation(RequestErrors errors)
    {
        foreach (var (field, messages) in errors.Errors)
            foreach (var message in messages)
                ModelState.AddModelError(field, message);
        return ValidationProblem(statusCode: errors.Unprocessable ? StatusCodes.Status422UnprocessableEntity : StatusCodes.Status400BadRequest,
            modelStateDictionary: ModelState);
    }
}
