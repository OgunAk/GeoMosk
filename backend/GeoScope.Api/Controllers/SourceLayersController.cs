using System.Text.Json;
using GeoScope.Api.Http;
using GeoScope.Application.Features;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Options;

namespace GeoScope.Api.Controllers;

/// <summary>İçe aktarılan kaynak katmanları (OSM). Yanıt: GeoJSON, EPSG:4326.</summary>
[ApiController]
[Route("api")]
// [Produces] kullanılmaz: hata yanıtlarının application/problem+json türünü de ezerdi.
public sealed class SourceLayersController(
    ISourceFeatureQueries queries,
    IOverrideCommands commands,
    IOptions<FeatureListOptions> options) : ControllerBase
{
    private const string GeoJson = "application/geo+json";
    private const int DistrictNameMax = 200;
    private const int FacilityNameMax = 300;

    /// <summary>Katman kataloğu: kimlik, başlık, geometri tipi, kaynak/atıf, düzenlenebilir alanlar, kayıt sayısı.</summary>
    [HttpGet("layers")]
    [ProducesResponseType<IReadOnlyList<LayerInfo>>(StatusCodes.Status200OK)]
    public async Task<IReadOnlyList<LayerInfo>> GetLayers(CancellationToken cancellationToken) =>
        await queries.GetLayersAsync(cancellationToken);

    /// <summary>İlçe sınırları (MultiPolygon).</summary>
    /// <param name="bbox">minLon,minLat,maxLon,maxLat (EPSG:4326); kesişen kayıtlar döner.</param>
    /// <param name="q">Görünen ad içinde arama (büyük/küçük harf ve Türkçe aksan duyarsız, en çok 100 karakter).</param>
    /// <param name="limit">Sayfa boyutu (varsayılan 250, en çok 2000).</param>
    /// <param name="offset">Atlanacak kayıt sayısı; sıralama id'ye göre sabittir.</param>
    [HttpGet("districts")]
    [ProducesResponseType<GeoJsonFeatureCollection>(StatusCodes.Status200OK, GeoJson)]
    [ProducesResponseType<ValidationProblemDetails>(StatusCodes.Status400BadRequest, "application/problem+json")]
    public Task<IActionResult> GetDistricts(string? bbox, string? q, int? limit, int? offset, CancellationToken cancellationToken) =>
        List(new FeatureListRequest(bbox, limit, offset, q), queries.GetDistrictsAsync, cancellationToken);

    /// <summary>Sağlık tesisleri (Point). Way/relation kaynaklarında nokta temsilîdir.</summary>
    /// <param name="type">Tesis türü: hospital, clinic, doctors, dentist, pharmacy, other_healthcare.</param>
    /// <param name="districtId">Yalnızca bu ilçenin kapsadığı (sınır dahil) tesisler.</param>
    [HttpGet("facilities")]
    [ProducesResponseType<GeoJsonFeatureCollection>(StatusCodes.Status200OK, GeoJson)]
    [ProducesResponseType<ValidationProblemDetails>(StatusCodes.Status400BadRequest, "application/problem+json")]
    public Task<IActionResult> GetFacilities(
        string? bbox, string? q, string? type, long? districtId, int? limit, int? offset, CancellationToken cancellationToken) =>
        List(new FeatureListRequest(bbox, limit, offset, q, type, districtId), queries.GetFacilitiesAsync, cancellationToken);

    /// <summary>Tek ilçe; kaynak etiketleri dahil. ETag = yerel düzenleme sürümü.</summary>
    [HttpGet("districts/{id:long}")]
    [ProducesResponseType<GeoJsonFeature>(StatusCodes.Status200OK, GeoJson)]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status404NotFound, "application/problem+json")]
    public async Task<IActionResult> GetDistrict(long id, CancellationToken cancellationToken) =>
        Single(await queries.GetDistrictAsync(id, cancellationToken), "İlçe");

    /// <summary>Tek tesis; kaynak etiketleri ve kapsayan ilçe adı dahil.</summary>
    [HttpGet("facilities/{id:long}")]
    [ProducesResponseType<GeoJsonFeature>(StatusCodes.Status200OK, GeoJson)]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status404NotFound, "application/problem+json")]
    public async Task<IActionResult> GetFacility(long id, CancellationToken cancellationToken) =>
        Single(await queries.GetFacilityAsync(id, cancellationToken), "Tesis");

    /// <summary>
    /// İlçenin yerel adı/açıklaması. Gövde: <c>{"name"?: string|null, "description"?: string|null}</c>;
    /// gönderilmeyen alan değişmez, <c>name: null</c> kaynak adına döner. <c>If-Match</c> zorunlu.
    /// Kaynak (OSM) verisi değişmez; import bu düzenlemeyi ezmez.
    /// </summary>
    [HttpPatch("districts/{id:long}")]
    [Consumes("application/json")]
    [ProducesResponseType<GeoJsonFeature>(StatusCodes.Status200OK, GeoJson)]
    [ProducesResponseType<ValidationProblemDetails>(StatusCodes.Status400BadRequest, "application/problem+json")]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status404NotFound, "application/problem+json")]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status412PreconditionFailed, "application/problem+json")]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status428PreconditionRequired, "application/problem+json")]
    public Task<IActionResult> PatchDistrict(long id, [FromBody] JsonElement body, CancellationToken cancellationToken) =>
        Patch(body, DistrictNameMax, (patch, version) => commands.UpdateDistrictAsync(id, patch, version, cancellationToken), "İlçe");

    /// <summary>Tesisin yerel adı/açıklaması (bkz. PATCH /api/districts/{id}).</summary>
    [HttpPatch("facilities/{id:long}")]
    [Consumes("application/json")]
    [ProducesResponseType<GeoJsonFeature>(StatusCodes.Status200OK, GeoJson)]
    [ProducesResponseType<ValidationProblemDetails>(StatusCodes.Status400BadRequest, "application/problem+json")]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status404NotFound, "application/problem+json")]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status412PreconditionFailed, "application/problem+json")]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status428PreconditionRequired, "application/problem+json")]
    public Task<IActionResult> PatchFacility(long id, [FromBody] JsonElement body, CancellationToken cancellationToken) =>
        Patch(body, FacilityNameMax, (patch, version) => commands.UpdateFacilityAsync(id, patch, version, cancellationToken), "Tesis");

    private async Task<IActionResult> List(
        FeatureListRequest request,
        Func<FeatureQuery, CancellationToken, Task<GeoJsonFeatureCollection>> load,
        CancellationToken cancellationToken)
    {
        var (query, errors) = FeatureQueryParser.Parse(request, options.Value);
        if (query is null) return ValidationFailure(errors);

        var collection = await load(query, cancellationToken);
        return new ObjectResult(collection) { ContentTypes = { GeoJson } };
    }

    private IActionResult Single(VersionedFeature? result, string label)
    {
        if (result is null) return Problem(statusCode: StatusCodes.Status404NotFound, title: $"{label} bulunamadı.");
        Response.Headers.ETag = ETags.Format(result.Version);
        return new ObjectResult(result.Feature) { ContentTypes = { GeoJson } };
    }

    private async Task<IActionResult> Patch(
        JsonElement body, int maxNameLength, Func<OverridePatch, uint, Task<OverrideUpdateResult>> update, string label)
    {
        if (!ETags.TryParseIfMatch(Request.Headers.IfMatch, out var expectedVersion, out var missing))
        {
            return missing
                ? Problem(statusCode: StatusCodes.Status428PreconditionRequired, title: "If-Match başlığı gerekli.",
                    detail: "Kayıp güncellemeyi önlemek için GET yanıtındaki ETag değerini If-Match ile gönderin.")
                : Problem(statusCode: StatusCodes.Status400BadRequest, title: "If-Match biçimi geçersiz.");
        }

        var (patch, errors) = OverridePatchParser.Parse(body, maxNameLength);
        if (patch is null) return ValidationFailure(errors);

        var result = await update(patch, expectedVersion);
        return result.Status switch
        {
            OverrideUpdateStatus.NotFound => Problem(statusCode: StatusCodes.Status404NotFound, title: $"{label} bulunamadı."),
            OverrideUpdateStatus.VersionMismatch => Problem(statusCode: StatusCodes.Status412PreconditionFailed,
                title: "Kayıt bu arada değişti.", detail: "Güncel kaydı yeniden yükleyip tekrar deneyin."),
            _ => Single(result.Feature, label),
        };
    }

    private IActionResult ValidationFailure(Dictionary<string, string[]> errors)
    {
        // ModelState üzerinden: ProblemDetailsFactory type/traceId alanlarını ekler.
        foreach (var (field, messages) in errors)
            foreach (var message in messages)
                ModelState.AddModelError(field, message);
        return ValidationProblem(ModelState);
    }
}
