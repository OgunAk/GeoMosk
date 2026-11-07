using NetTopologySuite.Geometries;

namespace GeoMosk.Domain.Districts;

/// <summary>İçe aktarılan ilçe sınırı. Kaynak alanları yalnızca import yazar; yerel düzenleme <see cref="DistrictOverride"/>'dadır.</summary>
public sealed class District
{
    public long Id { get; set; }
    public required string Source { get; set; }
    public required string SourceObjectType { get; set; }
    public long SourceId { get; set; }
    public required string Name { get; set; }
    /// <summary>Kaynak etiketlerinin değiştirilmemiş JSON kopyası.</summary>
    public required string Attributes { get; set; }
    /// <summary>EPSG:4326, [boylam, enlem].</summary>
    public required MultiPolygon Geom { get; set; }
    public DateTimeOffset? SourceTimestamp { get; set; }
    public long LastImportId { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }
    /// <summary>Kaynakta artık yoksa işaretlenir; override'lar korunur, kayıt silinmez.</summary>
    public DateTimeOffset? SourceDeletedAt { get; set; }

    public DistrictOverride? Override { get; set; }
}

/// <summary>Kaynak kayda ait uygulama içi sözel düzenleme. Null ad = kaynak adını kullan.</summary>
public sealed class DistrictOverride
{
    public long DistrictId { get; set; }
    public string? Name { get; set; }
    public string? Description { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }
    /// <summary>PostgreSQL xmin; iyimser eşzamanlılık belirteci.</summary>
    public uint Version { get; set; }
}
