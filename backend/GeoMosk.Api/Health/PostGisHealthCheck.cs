using GeoMosk.Application.Health;
using Microsoft.Extensions.Diagnostics.HealthChecks;

namespace GeoMosk.Api.Health;

internal sealed class PostGisHealthCheck(IDatabaseStatusProbe probe) : IHealthCheck
{
    public async Task<HealthCheckResult> CheckHealthAsync(HealthCheckContext context, CancellationToken cancellationToken = default)
    {
        var status = await probe.CheckAsync(cancellationToken);
        return status.IsAvailable
            ? HealthCheckResult.Healthy(data: new Dictionary<string, object> { ["postgisVersion"] = status.PostGisVersion ?? "" })
            : HealthCheckResult.Unhealthy("Veritabanına veya PostGIS'e ulaşılamıyor.");
    }
}
