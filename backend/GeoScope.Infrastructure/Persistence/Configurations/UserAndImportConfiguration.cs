using GeoScope.Domain.Imports;
using GeoScope.Domain.UserFeatures;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace GeoScope.Infrastructure.Persistence.Configurations;

internal sealed class UserFeatureConfiguration : IEntityTypeConfiguration<UserFeature>
{
    public void Configure(EntityTypeBuilder<UserFeature> b)
    {
        b.ToTable("user_features", t =>
        {
            // Multi*/GeometryCollection kabul edilmez; API sessizce dönüştürmez.
            t.HasCheckConstraint("ck_user_features_geom_type", "GeometryType(geom) IN ('POINT','LINESTRING','POLYGON')");
            t.HasCheckConstraint("ck_user_features_geom_valid", "NOT ST_IsEmpty(geom) AND ST_IsValid(geom)");
        });
        b.HasKey(x => x.Id);
        b.Property(x => x.Id).HasDefaultValueSql("gen_random_uuid()");
        b.Property(x => x.Name).HasMaxLength(200);
        b.Property(x => x.Description).HasMaxLength(2000);
        b.Property(x => x.Geom).HasColumnType("geometry(Geometry,4326)");
        b.Property(x => x.CreatedAt).HasDefaultValueSql("now()");
        b.Property(x => x.UpdatedAt).HasDefaultValueSql("now()");
        b.Property(x => x.Version).IsRowVersion();
        b.HasIndex(x => x.Geom).HasMethod("gist");
    }
}

internal sealed class ImportRunConfiguration : IEntityTypeConfiguration<ImportRun>
{
    public void Configure(EntityTypeBuilder<ImportRun> b)
    {
        b.ToTable("import_history", t =>
            t.HasCheckConstraint("ck_import_history_status", "status IN ('running','succeeded','failed')"));
        b.HasKey(x => x.Id);
        b.Property(x => x.Id).UseIdentityAlwaysColumn();
        b.Property(x => x.Source).HasMaxLength(32);
        b.Property(x => x.Dataset).HasMaxLength(64);
        b.Property(x => x.SnapshotId).HasMaxLength(64);
        b.Property(x => x.Checksum).HasMaxLength(64);
        b.Property(x => x.Status).HasMaxLength(16);
        b.Property(x => x.ErrorSummary).HasMaxLength(2000);
        b.Property(x => x.QualityReport).HasColumnType("jsonb");
        b.Property(x => x.StartedAt).HasDefaultValueSql("now()");
        b.HasIndex(x => new { x.Dataset, x.StartedAt });
    }
}
