using System.Text.Json.Serialization;
using NetTopologySuite.Geometries;

namespace GeoMosk.Application.Features;

/// <summary>
/// RFC 7946 Feature. Geometri EPSG:4326, [boylam, enlem]; serileştirme API katmanındaki GeoJSON dönüştürücüsüyle.
/// Id kaynak katmanlarda sayı (long), kullanıcı çizimlerinde metin (UUID); RFC 7946 ikisine de izin verir.
/// </summary>
public sealed record GeoJsonFeature(
    [property: JsonPropertyOrder(1)] object Id,
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

/// <summary>
/// Sayfa bilgisi. <see cref="NextAfter"/> keyset sayfalamada bir sonraki isteğin <c>after</c> değeridir (son dönen id);
/// yalnız kaynak katman listelerinde ve <see cref="HasMore"/> doğruysa dolu.
/// </summary>
public sealed record PageMeta(
    int Returned, int Limit, int Offset, bool HasMore,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] long? NextAfter = null);
