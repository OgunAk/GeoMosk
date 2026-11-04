using Testcontainers.PostgreSql;

namespace GeoScope.Tests.Infrastructure;

/// <summary>Gerçek PostGIS container'ı; docker-compose.yml ile aynı image etiketi.</summary>
public sealed class PostGisContainerFixture : IAsyncLifetime
{
    public const string Image = "postgis/postgis:17-3.5";

    private readonly PostgreSqlContainer _container = new PostgreSqlBuilder(Image)
        .WithDatabase("geoscope_test")
        .WithUsername("geoscope_test")
        .WithPassword("geoscope_test")
        .Build();

    public string ConnectionString => _container.GetConnectionString();

    public Task InitializeAsync() => _container.StartAsync();

    public Task DisposeAsync() => _container.DisposeAsync().AsTask();
}

[CollectionDefinition(Name)]
public sealed class PostGisCollection : ICollectionFixture<PostGisContainerFixture>
{
    public const string Name = "PostGIS";
}
