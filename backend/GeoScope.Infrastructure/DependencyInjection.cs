using GeoScope.Application.Analysis;
using GeoScope.Application.Features;
using GeoScope.Infrastructure.Analysis;
using GeoScope.Application.Health;
using GeoScope.Application.UserFeatures;
using GeoScope.Infrastructure.Features;
using GeoScope.Infrastructure.Health;
using GeoScope.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace GeoScope.Infrastructure;

public static class DependencyInjection
{
    public static IServiceCollection AddInfrastructure(this IServiceCollection services, string connectionString)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(connectionString);

        services.AddDbContext<GeoScopeDbContext>(options => ConfigureDbContext(options, connectionString));
        services.AddScoped<IDatabaseStatusProbe, PostGisStatusProbe>();
        services.AddScoped<ISourceFeatureQueries, SourceFeatureQueries>();
        services.AddScoped<IOverrideCommands, OverrideCommands>();
        services.AddScoped<IUserFeatureStore, UserFeatureStore>();
        services.AddScoped<IAnalysisService, AnalysisService>();
        return services;
    }

    internal static void ConfigureDbContext(DbContextOptionsBuilder options, string connectionString) =>
        options
            .UseNpgsql(connectionString, npgsql => npgsql.UseNetTopologySuite())
            .UseSnakeCaseNamingConvention();
}
