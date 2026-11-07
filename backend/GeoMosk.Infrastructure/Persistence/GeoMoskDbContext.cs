using GeoMosk.Domain.Districts;
using GeoMosk.Domain.Facilities;
using GeoMosk.Domain.Imports;
using GeoMosk.Domain.UserFeatures;
using Microsoft.EntityFrameworkCore;

namespace GeoMosk.Infrastructure.Persistence;

public sealed class GeoMoskDbContext(DbContextOptions<GeoMoskDbContext> options) : DbContext(options)
{
    public DbSet<District> Districts => Set<District>();
    public DbSet<DistrictOverride> DistrictOverrides => Set<DistrictOverride>();
    public DbSet<HealthFacility> HealthFacilities => Set<HealthFacility>();
    public DbSet<FacilityOverride> FacilityOverrides => Set<FacilityOverride>();
    public DbSet<UserFeature> UserFeatures => Set<UserFeature>();
    public DbSet<ImportRun> ImportHistory => Set<ImportRun>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.HasPostgresExtension("postgis");
        modelBuilder.HasPostgresExtension("unaccent");
        modelBuilder.HasPostgresExtension("pg_trgm"); // ad araması: '%…%' LIKE için GIN trigram indeksi (ADR-0020)
        modelBuilder.HasDbFunction(typeof(SearchFunctions).GetMethod(nameof(SearchFunctions.Normalize))!)
            .HasName(SearchFunctions.SqlName)
            .HasSchema("public");
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(GeoMoskDbContext).Assembly);
    }
}
