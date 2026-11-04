using NetTopologySuite.Geometries;

namespace GeoScope.Domain.UserFeatures;

/// <summary>Kullanıcı çizimi. Kaynak tablolarından ayrıdır; yalnızca Point/LineString/Polygon (EPSG:4326).</summary>
public sealed class UserFeature
{
    public Guid Id { get; set; }
    public required string Name { get; set; }
    public string? Description { get; set; }
    public required Geometry Geom { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }
    public uint Version { get; set; }
}
