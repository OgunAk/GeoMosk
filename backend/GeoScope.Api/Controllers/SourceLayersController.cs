using GeoScope.Application.Features;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Options;

namespace GeoScope.Api.Controllers;

/// <summary>İçe aktarılan kaynak katmanları (OSM). Yanıt: GeoJSON FeatureCollection, EPSG:4326.</summary>
[ApiController]
[Route("api")]
// [Produces] kullanılmaz: hata yanıtlarının application/problem+json türünü de ezerdi.
public sealed class SourceLayersController(ISourceFeatureQueries queries, IOptions<FeatureListOptions> options) : ControllerBase
{
    /// <summary>İlçe sınırları (MultiPolygon).</summary>
    /// <param name="bbox">minLon,minLat,maxLon,maxLat (EPSG:4326); kesişen kayıtlar döner.</param>
    /// <param name="limit">Sayfa boyutu (varsayılan 250, en çok 2000).</param>
    /// <param name="offset">Atlanacak kayıt sayısı; sıralama id'ye göre sabittir.</param>
    [HttpGet("districts")]
    [ProducesResponseType<GeoJsonFeatureCollection>(StatusCodes.Status200OK, "application/geo+json")]
    [ProducesResponseType<ValidationProblemDetails>(StatusCodes.Status400BadRequest, "application/problem+json")]
    public Task<IActionResult> GetDistricts(string? bbox, int? limit, int? offset, CancellationToken cancellationToken) =>
        List(bbox, limit, offset, queries.GetDistrictsAsync, cancellationToken);

    /// <summary>Sağlık tesisleri (Point). Way/relation kaynaklarında nokta temsilîdir.</summary>
    [HttpGet("facilities")]
    [ProducesResponseType<GeoJsonFeatureCollection>(StatusCodes.Status200OK, "application/geo+json")]
    [ProducesResponseType<ValidationProblemDetails>(StatusCodes.Status400BadRequest, "application/problem+json")]
    public Task<IActionResult> GetFacilities(string? bbox, int? limit, int? offset, CancellationToken cancellationToken) =>
        List(bbox, limit, offset, queries.GetFacilitiesAsync, cancellationToken);

    private async Task<IActionResult> List(
        string? bbox, int? limit, int? offset,
        Func<FeatureQuery, CancellationToken, Task<GeoJsonFeatureCollection>> load,
        CancellationToken cancellationToken)
    {
        var (query, errors) = FeatureQueryParser.Parse(bbox, limit, offset, options.Value);
        if (query is null)
        {
            // ModelState üzerinden: ProblemDetailsFactory type/traceId alanlarını ekler.
            foreach (var (field, messages) in errors)
                foreach (var message in messages)
                    ModelState.AddModelError(field, message);
            return ValidationProblem(ModelState);
        }

        var collection = await load(query, cancellationToken);
        return new ObjectResult(collection) { ContentTypes = { "application/geo+json" } };
    }
}
