using GeoMosk.Domain.Districts;
using GeoMosk.Domain.Facilities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace GeoMosk.Infrastructure.Persistence.Configurations;

// Geometri tipi/SRID kolon tipiyle, boşluk/geçerlilik CHECK ile DB'de de korunur.
// GiST ve geography ifade indeksleri migration'da (EF ifade indeksini modellemez).

internal sealed class DistrictConfiguration : IEntityTypeConfiguration<District>
{
    public void Configure(EntityTypeBuilder<District> b)
    {
        b.ToTable("districts", t =>
        {
            t.HasCheckConstraint("ck_districts_source_object_type", "source_object_type IN ('node','way','relation')");
            t.HasCheckConstraint("ck_districts_geom_valid", "NOT ST_IsEmpty(geom) AND ST_IsValid(geom)");
        });
        b.HasKey(x => x.Id);
        b.Property(x => x.Id).UseIdentityAlwaysColumn();
        b.Property(x => x.Source).HasMaxLength(32);
        b.Property(x => x.SourceObjectType).HasMaxLength(16);
        b.Property(x => x.Name).HasMaxLength(200);
        b.Property(x => x.Attributes).HasColumnType("jsonb");
        b.Property(x => x.Geom).HasColumnType("geometry(MultiPolygon,4326)");
        b.Property(x => x.CreatedAt).HasDefaultValueSql("now()");
        b.Property(x => x.UpdatedAt).HasDefaultValueSql("now()");
        b.HasIndex(x => new { x.Source, x.SourceObjectType, x.SourceId }).IsUnique();
        b.HasIndex(x => x.Geom).HasMethod("gist");
        b.HasOne(x => x.Override).WithOne().HasForeignKey<DistrictOverride>(o => o.DistrictId).OnDelete(DeleteBehavior.Cascade);
    }
}

internal sealed class DistrictOverrideConfiguration : IEntityTypeConfiguration<DistrictOverride>
{
    public void Configure(EntityTypeBuilder<DistrictOverride> b)
    {
        b.ToTable("district_overrides");
        b.HasKey(x => x.DistrictId);
        b.Property(x => x.Name).HasMaxLength(200);
        b.Property(x => x.Description).HasMaxLength(2000);
        b.Property(x => x.UpdatedAt).HasDefaultValueSql("now()");
        b.Property(x => x.Version).IsRowVersion();
    }
}

internal sealed class HealthFacilityConfiguration : IEntityTypeConfiguration<HealthFacility>
{
    public void Configure(EntityTypeBuilder<HealthFacility> b)
    {
        b.ToTable("health_facilities", t =>
        {
            t.HasCheckConstraint("ck_health_facilities_source_object_type", "source_object_type IN ('node','way','relation')");
            t.HasCheckConstraint("ck_health_facilities_geom_not_empty", "NOT ST_IsEmpty(geom)");
            t.HasCheckConstraint("ck_health_facilities_facility_type",
                "facility_type IN ('hospital','clinic','doctors','dentist','pharmacy','other_healthcare')");
            t.HasCheckConstraint("ck_health_facilities_source_geometry_srid", "source_geometry IS NULL OR ST_SRID(source_geometry) = 4326");
        });
        b.HasKey(x => x.Id);
        b.Property(x => x.Id).UseIdentityAlwaysColumn();
        b.Property(x => x.Source).HasMaxLength(32);
        b.Property(x => x.SourceObjectType).HasMaxLength(16);
        b.Property(x => x.Name).HasMaxLength(300);
        b.Property(x => x.FacilityType).HasMaxLength(32);
        b.Property(x => x.Attributes).HasColumnType("jsonb");
        b.Property(x => x.Geom).HasColumnType("geometry(Point,4326)");
        b.Property(x => x.SourceGeometry).HasColumnType("geometry(Geometry,4326)");
        b.Property(x => x.CreatedAt).HasDefaultValueSql("now()");
        b.Property(x => x.UpdatedAt).HasDefaultValueSql("now()");
        b.HasIndex(x => new { x.Source, x.SourceObjectType, x.SourceId }).IsUnique();
        b.HasIndex(x => x.Geom).HasMethod("gist");
        b.HasIndex(x => x.FacilityType);
        b.HasOne(x => x.Override).WithOne().HasForeignKey<FacilityOverride>(o => o.FacilityId).OnDelete(DeleteBehavior.Cascade);
    }
}

internal sealed class FacilityOverrideConfiguration : IEntityTypeConfiguration<FacilityOverride>
{
    public void Configure(EntityTypeBuilder<FacilityOverride> b)
    {
        b.ToTable("facility_overrides");
        b.HasKey(x => x.FacilityId);
        b.Property(x => x.Name).HasMaxLength(300);
        b.Property(x => x.Description).HasMaxLength(2000);
        b.Property(x => x.UpdatedAt).HasDefaultValueSql("now()");
        b.Property(x => x.Version).IsRowVersion();
    }
}
