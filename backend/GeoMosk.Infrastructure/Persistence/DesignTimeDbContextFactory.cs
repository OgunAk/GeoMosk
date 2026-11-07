using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace GeoMosk.Infrastructure.Persistence;

/// <summary>
/// dotnet ef (migrations add/bundle/script) için. Bağlantı yalnızca "database update" sırasında kullanılır;
/// bundle çalıştırılırken --connection ile verilir.
/// </summary>
internal sealed class DesignTimeDbContextFactory : IDesignTimeDbContextFactory<GeoMoskDbContext>
{
    public GeoMoskDbContext CreateDbContext(string[] args)
    {
        var connectionString = Environment.GetEnvironmentVariable("GEOMOSK_MIGRATION_CONNECTION")
            ?? "Host=localhost;Port=5432;Database=geomosk;Username=geomosk";
        var options = new DbContextOptionsBuilder<GeoMoskDbContext>();
        DependencyInjection.ConfigureDbContext(options, connectionString);
        return new GeoMoskDbContext(options.Options);
    }
}
