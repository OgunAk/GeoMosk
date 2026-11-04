using Microsoft.EntityFrameworkCore;

namespace GeoScope.Infrastructure.Persistence;

public sealed class GeoScopeDbContext(DbContextOptions<GeoScopeDbContext> options) : DbContext(options)
{
    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        // Şema tabloları Faz 2 migration'larıyla eklenir; extension yönetimi migration'da kalır.
        modelBuilder.HasPostgresExtension("postgis");
    }
}
