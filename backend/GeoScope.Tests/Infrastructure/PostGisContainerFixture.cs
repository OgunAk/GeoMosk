using GeoScope.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Npgsql;
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

    /// <summary>Test sınıfına özel, migration'ları uygulanmış yeni bir veritabanı oluşturur (testler birbirini etkilemez).</summary>
    public async Task<string> CreateMigratedDatabaseAsync(string prefix)
    {
        // xUnit her test için sınıfı yeniden oluşturur; ad benzersiz olmalı.
        var name = $"{prefix}_{Guid.NewGuid():N}"[..Math.Min(prefix.Length + 9, 63)];
        await using (var admin = new NpgsqlConnection(ConnectionString))
        {
            await admin.OpenAsync();
            await using var cmd = new NpgsqlCommand($"CREATE DATABASE \"{name}\"", admin);
            await cmd.ExecuteNonQueryAsync();
        }

        var connectionString = new NpgsqlConnectionStringBuilder(ConnectionString) { Database = name }.ConnectionString;
        await using var db = CreateDbContext(connectionString);
        await db.Database.MigrateAsync();
        return connectionString;
    }

    public static GeoScopeDbContext CreateDbContext(string connectionString)
    {
        var options = new DbContextOptionsBuilder<GeoScopeDbContext>();
        GeoScope.Infrastructure.DependencyInjection.ConfigureDbContext(options, connectionString);
        return new GeoScopeDbContext(options.Options);
    }
}

[CollectionDefinition(Name)]
public sealed class PostGisCollection : ICollectionFixture<PostGisContainerFixture>
{
    public const string Name = "PostGIS";
}
