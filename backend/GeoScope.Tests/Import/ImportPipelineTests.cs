using System.Text.Json;
using GeoScope.Tests.Infrastructure;

namespace GeoScope.Tests.Import;

/// <summary>scripts/import/load-osm.mjs'i sentetik fixture (data/test-fixtures/osm-mini) ile gerçek PostGIS'e karşı çalıştırır.</summary>
[Collection(PostGisCollection.Name)]
[Trait("Category", "Integration")]
public sealed class ImportPipelineTests(PostGisContainerFixture postgis)
{
    private static long FacilityId(string cs, string type, long sourceId) =>
        Sql.ScalarAsync<long>(cs, "SELECT id FROM health_facilities WHERE source_object_type = $1 AND source_id = $2", type, sourceId)
            .GetAwaiter().GetResult();

    private static async Task<JsonElement> RunOk(string snapshot, string cs)
    {
        var (exit, stdout, stderr) = await ImportRunner.RunAsync(snapshot, cs);
        Assert.True(exit == 0, $"import exit {exit}: {stderr}");
        return JsonDocument.Parse(stdout).RootElement;
    }

    [Fact]
    public async Task First_import_builds_valid_geometries_and_reports_quality()
    {
        var cs = await postgis.CreateMigratedDatabaseAsync("import_first");
        var result = await RunOk(ImportRunner.Fixture("v1"), cs);

        Assert.Equal(2, result.GetProperty("stats").GetProperty("districts").GetProperty("inserted").GetInt32());
        Assert.Equal(6, result.GetProperty("stats").GetProperty("facilities").GetProperty("inserted").GetInt32());

        // İki way'den birleşen dış halka + iç halka (delik) korunur.
        Assert.Equal(1, await Sql.ScalarAsync<int>(cs,
            "SELECT ST_NumInteriorRings(ST_GeometryN(geom, 1)) FROM districts WHERE source_id = 1"));
        // Delikteki eczane ilçe A tarafından kapsanmaz.
        Assert.False(await Sql.ScalarAsync<bool>(cs,
            "SELECT ST_Covers(d.geom, f.geom) FROM districts d, health_facilities f WHERE d.source_id = 1 AND f.source_id = 11"));
        // Way'den üretilen temsilî nokta özgün alanın içindedir.
        Assert.True(await Sql.ScalarAsync<bool>(cs,
            "SELECT ST_Covers(source_geometry, geom) FROM health_facilities WHERE source_object_type = 'way' AND source_id = 20"));
        // healthcare=doctor (amenity yok) → doctors
        Assert.Equal("doctors", await Sql.ScalarAsync<string>(cs, "SELECT facility_type FROM health_facilities WHERE source_id = 13"));

        var quality = result.GetProperty("quality");
        Assert.Equal(1, quality.GetProperty("facilitiesNotInAnyDistrict").GetInt32());
        Assert.Equal(1, quality.GetProperty("facilitiesInMultipleDistricts").GetInt32());
        Assert.Equal(1, quality.GetProperty("suspectedDuplicates").GetArrayLength());
        Assert.Equal(0, quality.GetProperty("districts").GetProperty("invalid").GetInt32());
    }

    [Fact]
    public async Task Reimporting_the_same_snapshot_changes_nothing()
    {
        var cs = await postgis.CreateMigratedDatabaseAsync("import_idempotent");
        await RunOk(ImportRunner.Fixture("v1"), cs);
        var updatedAtBefore = await Sql.ScalarAsync<DateTime>(cs, "SELECT max(updated_at) FROM health_facilities");

        var second = await RunOk(ImportRunner.Fixture("v1"), cs);

        var f = second.GetProperty("stats").GetProperty("facilities");
        Assert.Equal(0, f.GetProperty("inserted").GetInt32());
        Assert.Equal(0, f.GetProperty("updated").GetInt32());
        Assert.Equal(6, f.GetProperty("unchanged").GetInt32());
        Assert.Equal(6, await Sql.ScalarAsync<int>(cs, "SELECT count(*) FROM health_facilities"));
        Assert.Equal(updatedAtBefore, await Sql.ScalarAsync<DateTime>(cs, "SELECT max(updated_at) FROM health_facilities"));
    }

    [Fact]
    public async Task Source_update_keeps_local_overrides_and_marks_removed_records()
    {
        var cs = await postgis.CreateMigratedDatabaseAsync("import_override");
        await RunOk(ImportRunner.Fixture("v1"), cs);
        var hospitalId = FacilityId(cs, "node", 10);
        var doctorId = FacilityId(cs, "node", 13);
        await Sql.ExecAsync(cs, "INSERT INTO facility_overrides (facility_id, name, description) VALUES ($1, 'Yerel ad', 'Yerel not')", hospitalId);
        await Sql.ExecAsync(cs, "INSERT INTO facility_overrides (facility_id, description) VALUES ($1, 'Silinecek kaydın notu')", doctorId);

        var result = await RunOk(ImportRunner.Fixture("v2"), cs);

        var f = result.GetProperty("stats").GetProperty("facilities");
        Assert.Equal(1, f.GetProperty("updated").GetInt32());
        Assert.Equal(1, f.GetProperty("markedDeleted").GetInt32());
        Assert.Equal("Sentetik Devlet Hastanesi", await Sql.ScalarAsync<string>(cs, "SELECT name FROM health_facilities WHERE id = $1", hospitalId));
        Assert.Equal("Yerel ad", await Sql.ScalarAsync<string>(cs, "SELECT name FROM facility_overrides WHERE facility_id = $1", hospitalId));
        // Kaynaktan kalkan kayıt silinmez; override'ı korunur.
        Assert.True(await Sql.ScalarAsync<bool>(cs, "SELECT source_deleted_at IS NOT NULL FROM health_facilities WHERE id = $1", doctorId));
        Assert.Equal(2, await Sql.ScalarAsync<int>(cs, "SELECT count(*) FROM facility_overrides"));
    }

    [Fact]
    public async Task Corrupted_snapshot_is_rejected_without_touching_data()
    {
        var cs = await postgis.CreateMigratedDatabaseAsync("import_corrupt");
        await RunOk(ImportRunner.Fixture("v1"), cs);

        var corrupt = Directory.CreateTempSubdirectory("geoscope-corrupt-").FullName;
        try
        {
            foreach (var file in Directory.GetFiles(ImportRunner.Fixture("v2")))
                File.Copy(file, Path.Combine(corrupt, Path.GetFileName(file)));
            await File.AppendAllTextAsync(Path.Combine(corrupt, "facilities.json"), " ");

            var (exit, _, stderr) = await ImportRunner.RunAsync(corrupt, cs);

            Assert.NotEqual(0, exit);
            Assert.Contains("checksum", stderr);
            Assert.Equal("Sentetik Hastanesi", await Sql.ScalarAsync<string>(cs, "SELECT name FROM health_facilities WHERE source_id = 10"));
            Assert.Equal(0, await Sql.ScalarAsync<int>(cs, "SELECT count(*) FROM health_facilities WHERE source_deleted_at IS NOT NULL"));
        }
        finally
        {
            Directory.Delete(corrupt, recursive: true);
        }
    }
}
