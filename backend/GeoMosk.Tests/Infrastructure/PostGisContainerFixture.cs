using GeoMosk.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Npgsql;
using Testcontainers.PostgreSql;

namespace GeoMosk.Tests.Infrastructure;

/// <summary>Gerçek PostGIS container'ı; docker-compose.yml ile aynı image etiketi.</summary>
public sealed class PostGisContainerFixture : IAsyncLifetime
{
    public const string Image = "postgis/postgis:17-3.5";

    private readonly PostgreSqlContainer _container = new PostgreSqlBuilder(Image)
        .WithDatabase("geomosk_test")
        .WithUsername("geomosk_test")
        .WithPassword("geomosk_test")
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

        // Her test kendi veritabanını kullanır; havuz açık kalırsa boşta bağlantılar birikir ve
        // PostgreSQL max_connections (100) aşılır (53300). Test veritabanlarında havuz kapalı.
        var connectionString = new NpgsqlConnectionStringBuilder(ConnectionString) { Database = name, Pooling = false }.ConnectionString;
        await using var db = CreateDbContext(connectionString);
        await db.Database.MigrateAsync();
        return connectionString;
    }

    public static GeoMoskDbContext CreateDbContext(string connectionString)
    {
        var options = new DbContextOptionsBuilder<GeoMoskDbContext>();
        GeoMosk.Infrastructure.DependencyInjection.ConfigureDbContext(options, connectionString);
        return new GeoMoskDbContext(options.Options);
    }
}

[CollectionDefinition(Name)]
public sealed class PostGisCollection : ICollectionFixture<PostGisContainerFixture>
{
    public const string Name = "PostGIS";
}
