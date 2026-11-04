using System.Text.Json;
using GeoScope.Application.Analysis;
using GeoScope.Application.UserFeatures;
using Microsoft.AspNetCore.Mvc;

namespace GeoScope.Api.Controllers;

/// <summary>
/// Geometrik analizler (A01-A03), PostGIS ile backend'de. Girdi: kayıtlı obje (<c>sourceFeature</c>) veya doğrudan geometri.
/// Yanıt: haritada gösterilecek girdi (<c>input</c>) + bulunan tesisler (<c>matches</c>, GeoJSON FeatureCollection).
/// </summary>
[ApiController]
[Route("api/analysis")]
[Consumes("application/json")]
public sealed class AnalysisController(IAnalysisService analysis) : ControllerBase
{
    /// <summary>
    /// A01 — alan içindeki sağlık tesisleri. Gövde: <c>{"sourceFeature":{"layerId":"districts"|"user-features","id":…}}</c> veya
    /// <c>{"geometry": Polygon}</c>; <c>includeBoundary</c> (varsayılan true: sınırdaki tesisler dahil, ST_Covers).
    /// </summary>
    [HttpPost("within")]
    [ProducesResponseType<AnalysisResponse>(StatusCodes.Status200OK)]
    [ProducesResponseType<ValidationProblemDetails>(StatusCodes.Status400BadRequest, "application/problem+json")]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status404NotFound, "application/problem+json")]
    [ProducesResponseType<ValidationProblemDetails>(StatusCodes.Status422UnprocessableEntity, "application/problem+json")]
    public async Task<IActionResult> Within([FromBody] JsonElement body, CancellationToken cancellationToken)
    {
        var (request, errors) = AnalysisRequestParser.ParseWithin(body);
        return request is null ? Validation(errors) : ToResult(await analysis.WithinAsync(request, cancellationToken));
    }

    /// <summary>
    /// A02 — tampon. Gövde: <c>sourceFeature</c> veya <c>geometry</c>, <c>radiusMeters</c> (0 &lt; r ≤ 50000, metre),
    /// <c>excludeSource</c> (varsayılan true; yalnız kaynak tesisin kendisi, id ile hariç tutulur).
    /// </summary>
    [HttpPost("buffer")]
    [ProducesResponseType<AnalysisResponse>(StatusCodes.Status200OK)]
    [ProducesResponseType<ValidationProblemDetails>(StatusCodes.Status400BadRequest, "application/problem+json")]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status404NotFound, "application/problem+json")]
    [ProducesResponseType<ValidationProblemDetails>(StatusCodes.Status422UnprocessableEntity, "application/problem+json")]
    public async Task<IActionResult> Buffer([FromBody] JsonElement body, CancellationToken cancellationToken)
    {
        var (request, errors) = AnalysisRequestParser.ParseBuffer(body);
        return request is null ? Validation(errors) : ToResult(await analysis.BufferAsync(request, cancellationToken));
    }

    /// <summary>
    /// A03 — en yakın N tesis. Gövde: <c>{"point": Point, "n": 1..100, "type"?: tesis türü, "maxDistanceMeters"?: metre}</c>.
    /// Sonuçlar <c>rank</c> ve <c>distanceMeters</c> (kuş uçuşu, sferoid) içerir.
    /// </summary>
    [HttpPost("nearest")]
    [ProducesResponseType<AnalysisResponse>(StatusCodes.Status200OK)]
    [ProducesResponseType<ValidationProblemDetails>(StatusCodes.Status400BadRequest, "application/problem+json")]
    [ProducesResponseType<ValidationProblemDetails>(StatusCodes.Status422UnprocessableEntity, "application/problem+json")]
    public async Task<IActionResult> Nearest([FromBody] JsonElement body, CancellationToken cancellationToken)
    {
        var (request, errors) = AnalysisRequestParser.ParseNearest(body);
        return request is null ? Validation(errors) : ToResult(await analysis.NearestAsync(request, cancellationToken));
    }

    private IActionResult ToResult(AnalysisResult result) => result.Status switch
    {
        AnalysisStatus.SourceNotFound => Problem(statusCode: StatusCodes.Status404NotFound, title: result.Problem),
        AnalysisStatus.SourceNotApplicable => Validation(new RequestErrors(new() { ["sourceFeature"] = [result.Problem!] }, true)),
        _ => Ok(result.Response),
    };

    private IActionResult Validation(RequestErrors errors)
    {
        foreach (var (field, messages) in errors.Errors)
            foreach (var message in messages)
                ModelState.AddModelError(field, message);
        return ValidationProblem(statusCode: errors.Unprocessable ? StatusCodes.Status422UnprocessableEntity : StatusCodes.Status400BadRequest,
            modelStateDictionary: ModelState);
    }
}
