using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace GeoScope.Infrastructure.Persistence;

/// <summary>
/// dotnet ef (migrations add/bundle/script) için. Bağlantı yalnızca "database update" sırasında kullanılır;
/// bundle çalıştırılırken --connection ile verilir.
/// </summary>
internal sealed class DesignTimeDbContextFactory : IDesignTimeDbContextFactory<GeoScopeDbContext>
{
    public GeoScopeDbContext CreateDbContext(string[] args)
    {
        var connectionString = Environment.GetEnvironmentVariable("GEOSCOPE_MIGRATION_CONNECTION")
            ?? "Host=localhost;Port=5432;Database=geoscope;Username=geoscope";
        var options = new DbContextOptionsBuilder<GeoScopeDbContext>();
        DependencyInjection.ConfigureDbContext(options, connectionString);
        return new GeoScopeDbContext(options.Options);
    }
}
