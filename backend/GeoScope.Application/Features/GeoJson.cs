using System.Text.Json.Serialization;
using NetTopologySuite.Geometries;

namespace GeoScope.Application.Features;

/// <summary>RFC 7946 Feature. Geometri EPSG:4326, [boylam, enlem]; serileştirme API katmanındaki GeoJSON dönüştürücüsüyle.</summary>
public sealed record GeoJsonFeature(
    [property: JsonPropertyOrder(1)] long Id,
    [property: JsonPropertyOrder(2)] Geometry Geometry,
    [property: JsonPropertyOrder(3)] IReadOnlyDictionary<string, object?> Properties)
{
    [JsonPropertyOrder(0)]
    public string Type => "Feature";
}

/// <summary>
/// RFC 7946 FeatureCollection. <see cref="Meta"/> standardı bozmayan bir "foreign member"dır:
/// istemci sayfanın tüm veri olmadığını <c>hasMore</c> ile anlar.
/// </summary>
public sealed record GeoJsonFeatureCollection(
    [property: JsonPropertyOrder(1)] IReadOnlyList<GeoJsonFeature> Features,
    [property: JsonPropertyOrder(2)] PageMeta Meta)
{
    [JsonPropertyOrder(0)]
    public string Type => "FeatureCollection";
}

public sealed record PageMeta(int Returned, int Limit, int Offset, bool HasMore);
