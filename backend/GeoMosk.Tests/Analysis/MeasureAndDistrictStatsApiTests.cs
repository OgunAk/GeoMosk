using System.Net;
using System.Text;
using System.Text.Json;
using GeoMosk.Tests.Infrastructure;

namespace GeoMosk.Tests.Analysis;

/// <summary>
/// Faz 6: A04 metrik ölçüm (EPSG:32635) ve A05 ilçe başına tesis sayısı (tekil atama). Gerçek PostGIS, kontrollü sentetik geometriler.
/// Beklenen alan/uzunluk <see cref="TransverseMercatorReference"/> ve <see cref="GeodesicReference"/> ile bağımsız hesaplanır.
/// </summary>
[Collection(PostGisCollection.Name)]
[Trait("Category", "Spatial")]
public sealed class MeasureAndDistrictStatsApiTests(PostGisContainerFixture postgis) : IAsyncLifetime
{
    // Göreli tolerans (testten önce gerekçe): referans formüllerin seri hatası <1e-9; k'nin ≈1 km şekil içindeki değişimi ~1e-7;
    // UTM'de düz kenar ile eğri paralel/meridyen görüntüsü arasındaki fark karşılıklı kenarlarda aynı yönde olduğundan
    // büyük ölçüde birbirini götürür (tek kenar için üst sınır ~7e-6). 1e-5 bu toplamın üstünde, derece/projeksiyon hatalarının
    // (≥1e-3) çok altındadır.
    private const double RelativeTolerance = 1e-5;

    private GeoMoskApiFactory _factory = null!;
    private HttpClient _client = null!;
    private string _cs = "";
    private readonly Dictionary<string, long> _districts = [];

    public async Task InitializeAsync()
    {
        _cs = await postgis.CreateMigratedDatabaseAsync("api_measure_stats");

        // İlçeler (sentetik). d1 | d2 ortak kenar 29.10'da; d5, d1/d2 kenarının bir kısmını iç bölgesinde içerir (örtüşme senaryosu);
        // d3 tesissiz; "Doğu dışı" UTM 35N kullanım alanının (≤30°D) dışında.
        await District("d1", "POLYGON((29.00 40.00, 29.10 40.00, 29.10 40.10, 29.00 40.10, 29.00 40.00))");
        await District("d2", "POLYGON((29.10 40.00, 29.20 40.00, 29.20 40.10, 29.10 40.10, 29.10 40.00))");
        await District("d3", "POLYGON((29.30 40.00, 29.40 40.00, 29.40 40.10, 29.30 40.10, 29.30 40.00))");
        await District("d5", "POLYGON((29.05 40.05, 29.15 40.05, 29.15 40.15, 29.05 40.15, 29.05 40.05))");
        await District("İki parça", "MULTIPOLYGON(((28.20 40.30, 28.21 40.30, 28.21 40.31, 28.20 40.31, 28.20 40.30)),((28.30 40.30, 28.31 40.30, 28.31 40.31, 28.30 40.31, 28.30 40.30)))");
        await District("Doğu dışı", "POLYGON((30.02 40.00, 30.05 40.00, 30.05 40.02, 30.02 40.02, 30.02 40.00))");
        await Sql.ExecAsync(_cs, "INSERT INTO district_overrides (district_id, name, updated_at) VALUES ($1, 'Yerel ad', now())", _districts["d3"]);

        await Facility("yalnız d1", "pharmacy", 29.02, 40.02);
        await Facility("d1|d2 sınırı", "clinic", 29.10, 40.02);         // iki ilçe kapsar, ikisinde de sınırda → küçük id (d1)
        await Facility("d1|d2 sınırı, d5 içi", "dentist", 29.10, 40.07); // üç ilçe kapsar, yalnız d5'te iç → d5
        await Facility("yalnız d2", "hospital", 29.18, 40.02);
        await Facility("hiçbir ilçe", "hospital", 29.60, 40.50);        // atanamayan
        await Facility("silinmiş", "pharmacy", 29.02, 40.03, deleted: true);

        _factory = new GeoMoskApiFactory(_cs);
        _client = _factory.CreateClient();
    }

    public async Task DisposeAsync()
    {
        _client.Dispose();
        await _factory.DisposeAsync();
    }

    private static int _sourceId = 5000;

    private async Task District(string name, string wkt)
    {
        _districts[name] = await Sql.ScalarAsync<long>(_cs, """
            INSERT INTO districts (source, source_object_type, source_id, name, attributes, geom, last_import_id)
            VALUES ('test', 'relation', $1, $2, '{}'::jsonb, ST_Multi(ST_GeomFromText($3, 4326)), 0) RETURNING id
            """, (long)Interlocked.Increment(ref _sourceId), name, wkt);
    }

    private async Task Facility(string name, string type, double lon, double lat, bool deleted = false) =>
        await Sql.ExecAsync(_cs, """
            INSERT INTO health_facilities (source, source_object_type, source_id, name, facility_type, attributes, geom, last_import_id, source_deleted_at)
            VALUES ('test', 'node', $1, $2, $3, '{}'::jsonb, ST_SetSRID(ST_MakePoint($4, $5), 4326), 0, CASE WHEN $6 THEN now() END)
            """, (long)Interlocked.Increment(ref _sourceId), name, type, lon, lat, deleted);

    private async Task<(HttpStatusCode Status, JsonElement Body)> Post(object body)
    {
        var json = body as string ?? JsonSerializer.Serialize(body);
        var response = await _client.PostAsync("/api/analysis/measure", new StringContent(json, Encoding.UTF8, "application/json"));
        return (response.StatusCode, JsonDocument.Parse(await response.Content.ReadAsStringAsync()).RootElement);
    }

    private async Task<(HttpStatusCode Status, JsonElement Body)> Get(string path)
    {
        var response = await _client.GetAsync(path);
        return (response.StatusCode, JsonDocument.Parse(await response.Content.ReadAsStringAsync()).RootElement);
    }

    private static object Box(double lon1, double lat1, double lon2, double lat2) => new
    {
        type = "Polygon",
        coordinates = new[] { new[] { new[] { lon1, lat1 }, new[] { lon2, lat1 }, new[] { lon2, lat2 }, new[] { lon1, lat2 }, new[] { lon1, lat1 } } },
    };

    private static void AssertRelative(double expected, double actual) =>
        Assert.True(Math.Abs(actual - expected) / expected < RelativeTolerance,
            $"beklenen {expected:F3}, gelen {actual:F3}, göreli fark {(actual - expected) / expected:E2}");

    // ---------------- A04: ölçüm ----------------

    [Fact]
    public async Task Polygon_area_is_measured_in_utm35n_and_matches_independent_reference()
    {
        var (status, body) = await Post(new { geometry = Box(29.06, 40.19, 29.07, 40.20) });

        Assert.Equal(HttpStatusCode.OK, status);
        Assert.Equal("measure", body.GetProperty("analysis").GetString());
        var m = body.GetProperty("measurement");
        Assert.Equal(32635, m.GetProperty("calculationSrid").GetInt32());
        Assert.Equal("Polygon", m.GetProperty("geometryType").GetString());
        Assert.Equal(JsonValueKind.Null, m.GetProperty("lengthMeters").ValueKind);

        // ≈ 851 m × 1111 m ≈ 0.946 km². Derece² (1e-4) veya 3857 (≈1.7 kat) hatası bu kontrolü geçemez.
        AssertRelative(TransverseMercatorReference.UtmQuadrangleArea(29.06, 40.19, 29.07, 40.20), m.GetProperty("areaSquareMeters").GetDouble());
        var expectedPerimeter = 2 * GeodesicReference.NorthSouthMeters(40.19, 40.20) * TransverseMercatorReference.UtmScale(29.065, 40.195)
            + (GeodesicReference.EastWestMeters(40.19, 29.06, 29.07) + GeodesicReference.EastWestMeters(40.20, 29.06, 29.07))
              * TransverseMercatorReference.UtmScale(29.065, 40.195);
        AssertRelative(expectedPerimeter, m.GetProperty("perimeterMeters").GetDouble());

        // Çapraz kontrol (geography): Bursa'da UTM 35N ölçek farkı k² ∈ [0.9994, 1.0004] → |fark| < 1e-3.
        var check = m.GetProperty("geodesicCheck");
        AssertRelative(TransverseMercatorReference.QuadrangleArea(29.06, 40.19, 29.07, 40.20), check.GetProperty("areaSquareMeters").GetDouble());
        Assert.True(Math.Abs(check.GetProperty("relativeDifference").GetDouble()) < 1e-3);
    }

    [Fact]
    public async Task Projection_scale_is_applied_far_from_the_central_meridian()
    {
        // 28.2°D'de k² ≈ 0.99945: projeksiyon alanı sferoid alanından ~%0.055 küçük; test bu farkı görmeli (yalnız geography değil).
        var (_, body) = await Post(new { geometry = Box(28.20, 40.30, 28.21, 40.31) });
        var m = body.GetProperty("measurement");
        var area = m.GetProperty("areaSquareMeters").GetDouble();
        AssertRelative(TransverseMercatorReference.UtmQuadrangleArea(28.20, 40.30, 28.21, 40.31), area);
        var relative = m.GetProperty("geodesicCheck").GetProperty("relativeDifference").GetDouble();
        Assert.InRange(relative, -7e-4, -4e-4);
    }

    [Fact]
    public async Task Line_length_is_measured_and_area_is_not_reported()
    {
        var line = new { type = "LineString", coordinates = new[] { new[] { 29.06, 40.19 }, new[] { 29.06, 40.20 }, new[] { 29.06, 40.21 } } };
        var (status, body) = await Post(new { geometry = line });

        Assert.Equal(HttpStatusCode.OK, status);
        var m = body.GetProperty("measurement");
        Assert.Equal("LineString", m.GetProperty("geometryType").GetString());
        Assert.Equal(JsonValueKind.Null, m.GetProperty("areaSquareMeters").ValueKind);
        Assert.Equal(JsonValueKind.Null, m.GetProperty("perimeterMeters").ValueKind);
        var expected = GeodesicReference.NorthSouthMeters(40.19, 40.21) * TransverseMercatorReference.UtmScale(29.06, 40.20);
        AssertRelative(expected, m.GetProperty("lengthMeters").GetDouble()); // ≈ 2221 m
    }

    [Fact]
    public async Task Hole_is_excluded_from_area()
    {
        var withHole = new
        {
            type = "Polygon",
            coordinates = new[]
            {
                new[] { new[] { 29.06, 40.19 }, new[] { 29.08, 40.19 }, new[] { 29.08, 40.21 }, new[] { 29.06, 40.21 }, new[] { 29.06, 40.19 } },
                new[] { new[] { 29.065, 40.195 }, new[] { 29.065, 40.205 }, new[] { 29.075, 40.205 }, new[] { 29.075, 40.195 }, new[] { 29.065, 40.195 } },
            },
        };
        var (_, body) = await Post(new { geometry = withHole });
        var expected = TransverseMercatorReference.UtmQuadrangleArea(29.06, 40.19, 29.08, 40.21)
            - TransverseMercatorReference.UtmQuadrangleArea(29.065, 40.195, 29.075, 40.205);
        AssertRelative(expected, body.GetProperty("measurement").GetProperty("areaSquareMeters").GetDouble());
    }

    [Fact]
    public async Task District_source_multipolygon_area_sums_both_parts_and_keeps_input_on_map()
    {
        var id = _districts["İki parça"];
        var (status, body) = await Post(new { sourceFeature = new { layerId = "districts", id } });

        Assert.Equal(HttpStatusCode.OK, status);
        var m = body.GetProperty("measurement");
        Assert.Equal("MultiPolygon", m.GetProperty("geometryType").GetString());
        var expected = TransverseMercatorReference.UtmQuadrangleArea(28.20, 40.30, 28.21, 40.31)
            + TransverseMercatorReference.UtmQuadrangleArea(28.30, 40.30, 28.31, 40.31);
        AssertRelative(expected, m.GetProperty("areaSquareMeters").GetDouble());

        var input = body.GetProperty("input");
        Assert.Equal("MultiPolygon", input.GetProperty("geometry").GetProperty("type").GetString()); // haritada vurgulanacak, 4326
        Assert.Equal("districts", input.GetProperty("properties").GetProperty("sourceLayer").GetString());
        Assert.Equal("İki parça", input.GetProperty("properties").GetProperty("label").GetString());
    }

    [Fact]
    public async Task Points_are_an_unsupported_measurement_not_zero()
    {
        var (status, body) = await Post(new { geometry = new { type = "Point", coordinates = new[] { 29.06, 40.19 } } });
        Assert.Equal((HttpStatusCode)422, status);
        Assert.Contains("Desteklenmeyen ölçüm", body.GetProperty("errors").GetProperty("geometry")[0].GetString());

        (status, body) = await Post(new { sourceFeature = new { layerId = "facilities", id = 1 } });
        Assert.Equal((HttpStatusCode)422, status);
        Assert.Contains("Desteklenmeyen ölçüm", body.GetProperty("errors").GetProperty("sourceFeature.layerId")[0].GetString());
    }

    [Fact]
    public async Task User_point_feature_source_is_rejected_with_422()
    {
        var create = await _client.PostAsync("/api/features", new StringContent(
            """{"type":"Feature","geometry":{"type":"Point","coordinates":[29.06,40.19]},"properties":{"name":"Ölçüm noktası"}}""",
            Encoding.UTF8, "application/json"));
        Assert.Equal(HttpStatusCode.Created, create.StatusCode);
        var id = JsonDocument.Parse(await create.Content.ReadAsStringAsync()).RootElement.GetProperty("id").GetString();

        var (status, body) = await Post(new { sourceFeature = new { layerId = "user-features", id } });
        Assert.Equal((HttpStatusCode)422, status);
        Assert.Contains("Desteklenmeyen ölçüm", body.GetProperty("errors").GetProperty("sourceFeature")[0].GetString());
    }

    [Fact]
    public async Task Geometry_outside_utm35n_area_of_use_is_rejected()
    {
        // Bursa çalışma alanı 30.1°D'ye uzanır, UTM 35N 30°D'de biter: zon dışı ölçüm sessizce yapılmaz.
        var (status, body) = await Post(new { geometry = Box(30.02, 40.00, 30.05, 40.02) });
        Assert.Equal((HttpStatusCode)422, status);
        Assert.Contains("kullanım alanı dışında", body.GetProperty("errors").GetProperty("geometry")[0].GetString());

        (status, body) = await Post(new { sourceFeature = new { layerId = "districts", id = _districts["Doğu dışı"] } });
        Assert.Equal((HttpStatusCode)422, status);
        Assert.Contains("EPSG:32635", body.GetProperty("errors").GetProperty("sourceFeature")[0].GetString());
    }

    [Fact]
    public async Task Measure_input_errors()
    {
        Assert.Equal(HttpStatusCode.NotFound, (await Post(new { sourceFeature = new { layerId = "districts", id = 999999 } })).Status);
        Assert.Equal(HttpStatusCode.BadRequest, (await Post(new { geometry = Box(29.06, 40.19, 29.07, 40.20), sourceFeature = new { layerId = "districts", id = 1 } })).Status);
        Assert.Equal(HttpStatusCode.BadRequest, (await Post(new { geometry = Box(29.06, 40.19, 29.07, 40.20), srid = 3857 })).Status);
        // Kendini kesen alan → 422 (sessiz ST_MakeValid yok).
        var bowtie = new { type = "Polygon", coordinates = new[] { new[] { new[] { 29.06, 40.19 }, new[] { 29.07, 40.20 }, new[] { 29.07, 40.19 }, new[] { 29.06, 40.20 }, new[] { 29.06, 40.19 } } } };
        Assert.Equal((HttpStatusCode)422, (await Post(new { geometry = bowtie })).Status);
    }

    // ---------------- A05: ilçe başına tesis sayısı ----------------

    private static Dictionary<string, (int Count, int Multi)> Rows(JsonElement body) =>
        body.GetProperty("districts").EnumerateArray().ToDictionary(
            r => r.GetProperty("name").GetString()!,
            r => (r.GetProperty("facilityCount").GetInt32(), r.GetProperty("multiMatchCount").GetInt32()));

    [Fact]
    public async Task District_stats_assign_each_facility_once_and_show_empty_districts()
    {
        var (status, body) = await Get("/api/analysis/district-stats");
        Assert.Equal(HttpStatusCode.OK, status);
        var rows = Rows(body);

        Assert.Equal((2, 1), rows["d1"]);        // yalnız d1 + sınırdaki (iki sınır eşleşmesi → küçük id)
        Assert.Equal((1, 0), rows["d2"]);
        Assert.Equal((1, 1), rows["d5"]);        // iç eşleşme, küçük id'den önce gelir
        Assert.Equal((0, 0), rows["Yerel ad"]);  // tesissiz ilçe 0 (COUNT(*) olsaydı 1); ad override'dan
        Assert.Equal((0, 0), rows["İki parça"]);
        Assert.Equal(6, rows.Count);              // her ilçe listede

        var totals = body.GetProperty("totals");
        Assert.Equal(5, totals.GetProperty("facilities").GetInt32()); // silinmiş kayıt sayılmaz
        Assert.Equal(4, totals.GetProperty("assigned").GetInt32());
        Assert.Equal(1, totals.GetProperty("unassigned").GetInt32());
        Assert.Equal(2, totals.GetProperty("multiMatch").GetInt32());
        Assert.Equal(totals.GetProperty("assigned").GetInt32(), rows.Values.Sum(r => r.Count)); // çifte sayım yok
        Assert.Contains("Tekil atama", body.GetProperty("policy").GetString());
    }

    [Fact]
    public async Task Facility_detail_district_uses_the_same_single_assignment_as_district_stats()
    {
        async Task<string?> DistrictOf(string facilityName)
        {
            var id = await Sql.ScalarAsync<long>(_cs, "SELECT id FROM health_facilities WHERE name = $1", facilityName);
            var body = (await Get($"/api/facilities/{id}")).Body;
            return body.GetProperty("properties").GetProperty("districtName").GetString();
        }

        Assert.Equal("d5", await DistrictOf("d1|d2 sınırı, d5 içi")); // iç eşleşme, küçük id'den önce
        Assert.Equal("d1", await DistrictOf("d1|d2 sınırı"));         // yalnız sınır eşleşmeleri → küçük id
    }

    [Fact]
    public async Task Cors_exposes_etag_for_cross_origin_clients()
    {
        await using var factory = new GeoMoskApiFactory(_cs, ("Cors:AllowedOrigins:0", "http://localhost:5173"));
        using var client = factory.CreateClient();
        using var request = new HttpRequestMessage(HttpMethod.Get, "/api/districts?limit=1");
        request.Headers.Add("Origin", "http://localhost:5173");
        var response = await client.SendAsync(request);
        Assert.Contains("ETag", string.Join(",", response.Headers.GetValues("Access-Control-Expose-Headers")));
    }

    [Fact]
    public async Task District_stats_type_filter_and_validation()
    {
        var (status, body) = await Get("/api/analysis/district-stats?type=hospital");
        Assert.Equal(HttpStatusCode.OK, status);
        Assert.Equal("hospital", body.GetProperty("facilityType").GetString());
        var rows = Rows(body);
        Assert.Equal(1, rows["d2"].Count);
        Assert.Equal(0, rows["d1"].Count);
        Assert.Equal(1, body.GetProperty("totals").GetProperty("unassigned").GetInt32());

        (status, body) = await Get("/api/analysis/district-stats?type=hastane");
        Assert.Equal(HttpStatusCode.BadRequest, status);
        Assert.True(body.TryGetProperty("traceId", out _));
    }
}
