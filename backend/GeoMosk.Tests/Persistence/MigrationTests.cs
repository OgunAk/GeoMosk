using GeoMosk.Tests.Infrastructure;
using Microsoft.EntityFrameworkCore;
using Npgsql;

namespace GeoMosk.Tests.Persistence;

[Collection(PostGisCollection.Name)]
[Trait("Category", "Integration")]
public sealed class MigrationTests(PostGisContainerFixture postgis) : IAsyncLifetime
{
    private string _cs = "";

    public async Task InitializeAsync() => _cs = await postgis.CreateMigratedDatabaseAsync("migration_tests");
    public Task DisposeAsync() => Task.CompletedTask;

    [Fact]
    public async Task Migrations_are_idempotent_on_an_existing_schema()
    {
        await using var db = PostGisContainerFixture.CreateDbContext(_cs);
        await db.Database.MigrateAsync(); // ikinci uygulama no-op olmalı
        Assert.Empty(await db.Database.GetPendingMigrationsAsync());
    }

    // geometry_columns görünümü genel Geometry kolonunda tipi CHECK ifadesinden tahmin eder (user_features için
    // yanıltıcı "POINT" döner); gerçek typmod katalogdan okunur.
    [Theory]
    [InlineData("districts", "geometry(MultiPolygon,4326)")]
    [InlineData("health_facilities", "geometry(Point,4326)")]
    [InlineData("user_features", "geometry(Geometry,4326)")]
    public async Task Geometry_columns_are_typed_and_stored_in_4326(string table, string expectedType)
    {
        var type = await Sql.ScalarAsync<string>(_cs,
            "SELECT format_type(a.atttypid, a.atttypmod) FROM pg_attribute a JOIN pg_class c ON c.oid = a.attrelid " +
            "WHERE c.relname = $1 AND a.attname = 'geom'", table);
        Assert.Equal(expectedType, type);
    }

    [Theory]
    [InlineData("SRID=4326;POINT(29.06 40.19)")]
    [InlineData("SRID=4326;LINESTRING(29.0 40.1, 29.1 40.2)")]
    [InlineData("SRID=4326;POLYGON((29.0 40.1, 29.1 40.1, 29.1 40.2, 29.0 40.1))")]
    public async Task User_feature_accepts_point_linestring_and_polygon(string ewkt)
    {
        var id = Guid.NewGuid();
        await Sql.ExecAsync(_cs, "INSERT INTO user_features (id, name, geom) VALUES ($1, 'ok', ST_GeomFromEWKT($2))", id, ewkt);
        Assert.Equal(1, await Sql.ScalarAsync<int>(_cs, "SELECT count(*) FROM user_features WHERE id = $1", id));
    }

    [Theory]
    [InlineData("ix_districts_geom", "gist")]
    [InlineData("ix_health_facilities_geom", "gist")]
    [InlineData("ix_user_features_geom", "gist")]
    [InlineData("ix_health_facilities_geog", "geography")]
    [InlineData("ix_districts_name_trgm", "gin_trgm_ops")]
    [InlineData("ix_district_overrides_name_trgm", "gin_trgm_ops")]
    [InlineData("ix_health_facilities_name_trgm", "gin_trgm_ops")]
    [InlineData("ix_facility_overrides_name_trgm", "gin_trgm_ops")]
    public async Task Spatial_and_search_indexes_exist(string index, string expectedFragment)
    {
        var def = await Sql.ScalarAsync<string>(_cs, "SELECT indexdef FROM pg_indexes WHERE indexname = $1", index);
        Assert.Contains(expectedFragment, def, StringComparison.OrdinalIgnoreCase);
    }

    // Arama sorgusunun ifadesi (normalize(ad) LIKE '%' || normalize(@q) || '%') trigram indeksine eşleşmeli; aksi halde
    // indeks hiç kullanılmaz. Küçük tabloda planlayıcı zaten sıralı taramayı seçeceği için seqscan kapatılarak denetlenir.
    [Theory]
    [InlineData("health_facilities", "ix_health_facilities_name_trgm")]
    [InlineData("districts", "ix_districts_name_trgm")]
    public async Task Name_search_expression_can_use_trigram_index(string table, string index)
    {
        await using var conn = new NpgsqlConnection(_cs);
        await conn.OpenAsync();
        await using (var off = new NpgsqlCommand("SET enable_seqscan = off", conn)) await off.ExecuteNonQueryAsync();
        await using var cmd = new NpgsqlCommand(
            $"EXPLAIN SELECT id FROM {table} WHERE public.geomosk_search_normalize(name) " +
            "LIKE '%' || COALESCE(public.geomosk_search_normalize($1), '') || '%' ESCAPE '\\'", conn); // EF'in ürettiği biçim
        cmd.Parameters.AddWithValue("hastane");
        var plan = new List<string>();
        await using (var reader = await cmd.ExecuteReaderAsync())
            while (await reader.ReadAsync()) plan.Add(reader.GetString(0));
        Assert.Contains(plan, line => line.Contains(index, StringComparison.Ordinal));
    }

    [Theory]
    [InlineData("SRID=4326;POLYGON((0 0, 1 1, 1 0, 0 1, 0 0))", "ck_user_features_geom_valid")] // kendini kesen
    [InlineData("SRID=4326;MULTIPOINT((0 0), (1 1))", "ck_user_features_geom_type")]
    [InlineData("SRID=4326;POINT EMPTY", "ck_user_features_geom_valid")]
    public async Task User_feature_constraints_reject_invalid_geometry(string ewkt, string constraint)
    {
        var ex = await Assert.ThrowsAsync<PostgresException>(() => Sql.ExecAsync(_cs,
            "INSERT INTO user_features (name, geom) VALUES ('x', ST_GeomFromEWKT($1))", ewkt));
        Assert.Equal(PostgresErrorCodes.CheckViolation, ex.SqlState);
        Assert.Equal(constraint, ex.ConstraintName);
    }

    [Fact]
    public async Task Typed_column_rejects_wrong_srid()
    {
        var ex = await Assert.ThrowsAsync<PostgresException>(() => Sql.ExecAsync(_cs,
            "INSERT INTO user_features (name, geom) VALUES ('x', ST_GeomFromEWKT('SRID=3857;POINT(3234000 4893000)'))"));
        Assert.Contains("SRID", ex.MessageText, StringComparison.OrdinalIgnoreCase);
    }
}
