using GeoMosk.Application.Analysis;
using GeoMosk.Application.Features;
using GeoMosk.Infrastructure.Analysis;
using GeoMosk.Application.Health;
using GeoMosk.Application.UserFeatures;
using GeoMosk.Infrastructure.Features;
using GeoMosk.Infrastructure.Health;
using GeoMosk.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace GeoMosk.Infrastructure;

public static class DependencyInjection
{
    public static IServiceCollection AddInfrastructure(this IServiceCollection services, string connectionString)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(connectionString);

        services.AddDbContext<GeoMoskDbContext>(options => ConfigureDbContext(options, connectionString));
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
