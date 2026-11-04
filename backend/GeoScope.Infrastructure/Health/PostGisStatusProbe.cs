using GeoScope.Application.Health;
using GeoScope.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Npgsql;

namespace GeoScope.Infrastructure.Health;

internal sealed class PostGisStatusProbe(GeoScopeDbContext db, ILogger<PostGisStatusProbe> logger) : IDatabaseStatusProbe
{
    public async Task<DatabaseStatus> CheckAsync(CancellationToken cancellationToken)
    {
        try
        {
            // postgis_lib_version() yalnızca extension kuruluysa vardır; DB erişimi ve PostGIS'i birlikte doğrular.
            var version = await db.Database
                .SqlQuery<string>($"SELECT postgis_lib_version() AS \"Value\"")
                .SingleAsync(cancellationToken);
            return new DatabaseStatus(true, version);
        }
        catch (Exception ex) when (ex is NpgsqlException or InvalidOperationException or TimeoutException
                                   && !cancellationToken.IsCancellationRequested)
        {
            // Bağlantı ayrıntısı loga gider; health yanıtına sızmaz.
            logger.LogWarning(ex, "PostGIS hazırlık kontrolü başarısız");
            return DatabaseStatus.Unavailable;
        }
    }
}
