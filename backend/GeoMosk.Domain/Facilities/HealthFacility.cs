using NetTopologySuite.Geometries;

namespace GeoMosk.Domain.Facilities;

/// <summary>İçe aktarılan sağlık tesisi. <see cref="Geom"/> analizlerde kullanılan temsilî noktadır.</summary>
public sealed class HealthFacility
{
    public long Id { get; set; }
    public required string Source { get; set; }
    public required string SourceObjectType { get; set; }
    public long SourceId { get; set; }
    public string? Name { get; set; }
    public required string FacilityType { get; set; }
    public required string Attributes { get; set; }
    /// <summary>EPSG:4326 nokta. Way/relation kaynaklarında ST_PointOnSurface ile üretilir; giriş kapısı/adres değildir.</summary>
    public required Point Geom { get; set; }
    /// <summary>Way/relation kaynaklarının özgün alan/çizgi geometrisi; node için null.</summary>
    public Geometry? SourceGeometry { get; set; }
    public DateTimeOffset? SourceTimestamp { get; set; }
    public long LastImportId { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }
    public DateTimeOffset? SourceDeletedAt { get; set; }

    public FacilityOverride? Override { get; set; }
}

public sealed class FacilityOverride
{
    public long FacilityId { get; set; }
    public string? Name { get; set; }
    public string? Description { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }
    public uint Version { get; set; }
}

/// <summary>Normalleştirilmiş tesis türleri (import: amenity, yoksa healthcare etiketi).</summary>
public static class FacilityTypes
{
    public const string Hospital = "hospital";
    public const string Clinic = "clinic";
    public const string Doctors = "doctors";
    public const string Dentist = "dentist";
    public const string Pharmacy = "pharmacy";
    public const string OtherHealthcare = "other_healthcare";

    public static readonly IReadOnlyList<string> All = [Hospital, Clinic, Doctors, Dentist, Pharmacy, OtherHealthcare];
}
