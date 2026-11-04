using GeoScope.Domain.Districts;
using GeoScope.Domain.Facilities;
using GeoScope.Domain.Imports;
using GeoScope.Domain.UserFeatures;
using Microsoft.EntityFrameworkCore;

namespace GeoScope.Infrastructure.Persistence;

public sealed class GeoScopeDbContext(DbContextOptions<GeoScopeDbContext> options) : DbContext(options)
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
        modelBuilder.HasDbFunction(typeof(SearchFunctions).GetMethod(nameof(SearchFunctions.Normalize))!)
            .HasName(SearchFunctions.SqlName)
            .HasSchema("public");
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(GeoScopeDbContext).Assembly);
    }
}
