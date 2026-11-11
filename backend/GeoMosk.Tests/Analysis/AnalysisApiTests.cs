using System.Globalization;
using System.Net;
using System.Text;
using System.Text.Json;
using GeoMosk.Tests.Infrastructure;

namespace GeoMosk.Tests.Analysis;

/// <summary>
/// Faz 5: A01 alan içinde, A02 tampon, A03 en yakın N — gerçek PostGIS, sentetik fixture + kontrollü test noktaları.
/// Beklenen mesafeler <see cref="GeodesicReference"/> ile bağımsız hesaplanır.
/// </summary>
[Collection(PostGisCollection.Name)]
[Trait("Category", "Spatial")]
public sealed class AnalysisApiTests(PostGisContainerFixture postgis) : IAsyncLifetime
{
    // Test noktalarının merkezi; fixture ilçelerinden (29.0-29.2, 40.0-40.1) ~25 km uzakta.
    private const double OLon = 29.30, OLat = 40.30;
    private const double Radius = 2000;
    // Mesafe toleransı: sferoid hesabı ile bağımsız referans arasındaki fark (yöntem farkı mm düzeyinde).
    private const double ToleranceMeters = 0.05;

    private GeoMoskApiFactory _factory = null!;
    private HttpClient _client = null!;
    private string _cs = "";
    private readonly Dictionary<string, (long Id, double Lon, double Lat)> _points = [];

    public async Task InitializeAsync()
    {
        _cs = await postgis.CreateMigratedDatabaseAsync("api_analysis");
        var (exit, _, stderr) = await ImportRunner.RunAsync(ImportRunner.Fixture("v1"), _cs);
        Assert.True(exit == 0, stderr);

        var n1990 = GeodesicReference.LatitudeNorthOf(OLat, 1990);
        var n2010 = GeodesicReference.LatitudeNorthOf(OLat, 2010);
        await Add("Kaynak", "hospital", OLon, OLat);
        await Add("Aynı konum", "pharmacy", OLon, OLat);          // kaynakla aynı koordinat, farklı tesis
        await Add("Doğu 0.01", "pharmacy", OLon + 0.01, OLat);     // ~852 m
        await Add("Batı 0.01", "clinic", OLon - 0.01, OLat);       // doğuyla eşit mesafe → id bağ kırıcı
        await Add("Kuzey 1990", "dentist", OLon, n1990);           // tamponun 10 m içinde
        await Add("Kuzey 2010", "dentist", OLon, n2010);           // tamponun 10 m dışında
        await Add("Doğu 0.02", "hospital", OLon + 0.02, OLat);     // ~1705 m: içeride
        await Add("Kuzey 0.02", "hospital", OLon, OLat + 0.02);    // ~2221 m: dışarıda (derecede ikisi de 0.02)
        // İki parçalı ilçe: ikinci parçadaki tesis de kapsanmalı.
        await Sql.ExecAsync(_cs, """
            INSERT INTO districts (source, source_object_type, source_id, name, attributes, geom, last_import_id)
            VALUES ('test', 'relation', 900, 'Çok parçalı', '{}'::jsonb,
              ST_GeomFromText('MULTIPOLYGON(((29.29 40.29, 29.31 40.29, 29.31 40.31, 29.29 40.31, 29.29 40.29)),
                                            ((29.40 40.40, 29.41 40.40, 29.41 40.41, 29.40 40.41, 29.40 40.40)))', 4326), 0)
            """);
        await Add("İkinci parçada", "clinic", 29.405, 40.405);

        _factory = new GeoMoskApiFactory(_cs);
        _client = _factory.CreateClient();
    }

    public async Task DisposeAsync()
    {
        _client.Dispose();
        await _factory.DisposeAsync();
    }

    private static int _sourceId = 1000;

    private async Task Add(string name, string type, double lon, double lat)
    {
        var id = await Sql.ScalarAsync<long>(_cs, """
            INSERT INTO health_facilities (source, source_object_type, source_id, name, facility_type, attributes, geom, last_import_id)
            VALUES ('test', 'node', $1, $2, $3, '{}'::jsonb, ST_SetSRID(ST_MakePoint($4, $5), 4326), 0) RETURNING id
            """, (long)Interlocked.Increment(ref _sourceId), name, type, lon, lat);
        _points[name] = (id, lon, lat);
    }

    private double Reference(string name, double fromLon = OLon, double fromLat = OLat)
    {
        var (_, lon, lat) = _points[name];
        // Test noktaları ya aynı meridyende ya aynı paralelde.
        return lon == fromLon ? GeodesicReference.NorthSouthMeters(fromLat, lat) : GeodesicReference.EastWestMeters(lat, fromLon, lon);
    }

    private async Task<(HttpStatusCode Status, JsonElement Body)> Post(string path, object body)
    {
        var json = body as string ?? JsonSerializer.Serialize(body);
        var response = await _client.PostAsync(path, new StringContent(json, Encoding.UTF8, "application/json"));
        return (response.StatusCode, JsonDocument.Parse(await response.Content.ReadAsStringAsync()).RootElement);
    }

    private static string[] Names(JsonElement response) =>
        response.GetProperty("matches").GetProperty("features").EnumerateArray()
            .Select(f => f.GetProperty("properties").GetProperty("name").GetString()!).ToArray();

    private static object Point(double lon, double lat) => new { type = "Point", coordinates = new[] { lon, lat } };

    // ---------------- A02: tampon ----------------

    [Fact]
    public async Task Buffer_selects_by_spheroid_meters_not_degrees()
    {
        var (status, body) = await Post("/api/analysis/buffer",
            new { sourceFeature = new { layerId = "facilities", id = _points["Kaynak"].Id.ToString(CultureInfo.InvariantCulture) }, radiusMeters = Radius });

        Assert.Equal(HttpStatusCode.OK, status);
        var names = Names(body);
        // Bağımsız referansa göre beklenen küme (kaynak hariç, aynı koordinattaki farklı tesis dahil).
        var expected = _points.Keys.Where(k => k is not "Kaynak" and not "İkinci parçada" && Reference(k) <= Radius).ToHashSet();
        Assert.Equal(expected.Order(), names.Order());
        Assert.Contains("Doğu 0.02", names);      // 0.02° boylam ≈ 1705 m → içeride
        Assert.DoesNotContain("Kuzey 0.02", names); // 0.02° enlem ≈ 2221 m → dışarıda (derece hatası bunu yakalardı)
        Assert.Contains("Kuzey 1990", names);
        Assert.DoesNotContain("Kuzey 2010", names);
        Assert.Contains("Aynı konum", names);
        Assert.DoesNotContain("Kaynak", names);

        foreach (var f in body.GetProperty("matches").GetProperty("features").EnumerateArray())
        {
            var name = f.GetProperty("properties").GetProperty("name").GetString()!;
            Assert.Equal(Reference(name), f.GetProperty("properties").GetProperty("distanceMeters").GetDouble(), ToleranceMeters);
        }
    }

    [Fact]
    public async Task Buffer_can_include_the_source_and_reports_method()
    {
        var (_, body) = await Post("/api/analysis/buffer",
            new { sourceFeature = new { layerId = "facilities", id = _points["Kaynak"].Id }, radiusMeters = 100, excludeSource = false });

        Assert.Equal(["Aynı konum", "Kaynak"], Names(body).Order());
        Assert.Contains("ST_DWithin(geography)", body.GetProperty("parameters").GetProperty("method").GetString());
        Assert.Equal(100, body.GetProperty("parameters").GetProperty("radiusMeters").GetDouble());
    }

    [Fact]
    public async Task Buffer_polygon_is_an_approximate_circle_of_the_requested_radius()
    {
        var (_, body) = await Post("/api/analysis/buffer", new { geometry = Point(OLon, OLat), radiusMeters = Radius });

        var input = body.GetProperty("input");
        Assert.Equal("Polygon", input.GetProperty("geometry").GetProperty("type").GetString());
        var area = await Sql.ScalarAsync<double>(_cs, "SELECT ST_Area(ST_GeomFromGeoJSON($1)::geography)", input.GetProperty("geometry").GetRawText());
        // 64 kenarlı çokgenin alanı πr²'nin ~%99.8'i; %1 tolerans görsel yaklaşımı belgeler.
        Assert.InRange(area / (Math.PI * Radius * Radius), 0.99, 1.0);
    }

    [Fact]
    public async Task Buffer_around_a_drawn_line_measures_distance_to_the_line()
    {
        // Doğu-batı doğrultusunda çizgi; "Kuzey 1990" çizgiye 1990 m, "Kuzey 2010" 2010 m uzaklıkta.
        var line = new { type = "LineString", coordinates = new[] { new[] { OLon - 0.005, OLat }, new[] { OLon + 0.005, OLat } } };
        var (status, body) = await Post("/api/analysis/buffer", new { geometry = line, radiusMeters = 2000 });

        Assert.Equal(HttpStatusCode.OK, status);
        Assert.Contains("Kuzey 1990", Names(body));
        Assert.DoesNotContain("Kuzey 2010", Names(body));
    }

    [Theory]
    [InlineData(0)]
    [InlineData(-5)]
    [InlineData(50_001)]
    public async Task Buffer_rejects_non_positive_or_excessive_radius(double radius)
    {
        var (status, body) = await Post("/api/analysis/buffer", new { geometry = Point(OLon, OLat), radiusMeters = radius });

        Assert.Equal(HttpStatusCode.BadRequest, status);
        Assert.True(body.GetProperty("errors").TryGetProperty("radiusMeters", out _));
    }

    // ---------------- A03: en yakın N ----------------

    [Fact]
    public async Task Nearest_returns_exact_spheroid_order_with_id_tie_breaker()
    {
        var (status, body) = await Post("/api/analysis/nearest", new { point = Point(OLon, OLat), n = 6 });

        Assert.Equal(HttpStatusCode.OK, status);
        var features = body.GetProperty("matches").GetProperty("features").EnumerateArray().ToList();
        // Bağımsız referans sıralaması: (mesafe, id).
        var expected = _points.Keys.Where(k => k != "İkinci parçada")
            .OrderBy(k => Math.Round(Reference(k), 3)).ThenBy(k => _points[k].Id).Take(6).ToArray();
        Assert.Equal(expected, features.Select(f => f.GetProperty("properties").GetProperty("name").GetString()).ToArray());
        Assert.Equal(Enumerable.Range(1, 6), features.Select(f => f.GetProperty("properties").GetProperty("rank").GetInt32()));
        // Eşit mesafe: Doğu 0.01 ve Batı 0.01 — id küçük olan önce (Doğu önce eklendi).
        var east = expected.ToList().IndexOf("Doğu 0.01");
        var west = expected.ToList().IndexOf("Batı 0.01");
        Assert.True(east < west);
        foreach (var f in features)
        {
            var name = f.GetProperty("properties").GetProperty("name").GetString()!;
            Assert.Equal(Reference(name), f.GetProperty("properties").GetProperty("distanceMeters").GetDouble(), ToleranceMeters);
        }
    }

    [Fact]
    public async Task Nearest_with_n_larger_than_data_returns_everything_and_supports_filters()
    {
        var total = await Sql.ScalarAsync<int>(_cs, "SELECT count(*) FROM health_facilities WHERE source_deleted_at IS NULL");

        var (_, all) = await Post("/api/analysis/nearest", new { point = Point(OLon, OLat), n = 100 });
        var (_, pharmacies) = await Post("/api/analysis/nearest", new { point = Point(OLon, OLat), n = 100, type = "pharmacy" });
        var (_, within1km) = await Post("/api/analysis/nearest", new { point = Point(OLon, OLat), n = 100, maxDistanceMeters = 1000 });

        Assert.Equal(total, all.GetProperty("matches").GetProperty("features").GetArrayLength());
        Assert.All(pharmacies.GetProperty("matches").GetProperty("features").EnumerateArray(),
            f => Assert.Equal("pharmacy", f.GetProperty("properties").GetProperty("facilityType").GetString()));
        Assert.Equal(["Aynı konum", "Batı 0.01", "Doğu 0.01", "Kaynak"], Names(within1km).Order());
    }

    // Geliştirici testi (2026-11-09): haritada yalnız bazı türler işaretliyken analiz de o türlerle sınırlı kalmalı.
    private static string[] Types(JsonElement response) =>
        response.GetProperty("matches").GetProperty("features").EnumerateArray()
            .Select(f => f.GetProperty("properties").GetProperty("facilityType").GetString()!).Distinct().ToArray();

    [Fact]
    public async Task Analyses_are_limited_to_requested_facility_types()
    {
        var square = new
        {
            type = "Polygon",
            coordinates = new[] { new[] { new[] { 29.285, 40.295 }, new[] { 29.315, 40.295 }, new[] { 29.315, 40.305 }, new[] { 29.285, 40.305 }, new[] { 29.285, 40.295 } } },
        };
        var (_, within) = await Post("/api/analysis/within", new { geometry = square, types = new[] { "hospital" } });
        var (_, buffer) = await Post("/api/analysis/buffer", new { geometry = Point(OLon, OLat), radiusMeters = Radius, types = new[] { "pharmacy" } });
        var (_, nearest) = await Post("/api/analysis/nearest", new { point = Point(OLon, OLat), n = 100, types = new[] { "hospital", "pharmacy" } });

        Assert.Equal(["Kaynak"], Names(within));
        Assert.Equal(["pharmacy"], Types(buffer));
        Assert.Contains("Doğu 0.01", Names(buffer));
        Assert.DoesNotContain("Kaynak", Names(buffer)); // hospital
        var expected = await Sql.ScalarAsync<int>(_cs, "SELECT count(*) FROM health_facilities WHERE source_deleted_at IS NULL AND facility_type IN ('hospital', 'pharmacy')");
        Assert.Equal(expected, nearest.GetProperty("matches").GetProperty("features").GetArrayLength());
        Assert.Equal(["hospital", "pharmacy"], Types(nearest).Order());
    }

    [Fact]
    public async Task Invalid_facility_type_filters_are_rejected()
    {
        var area = new { sourceFeature = new { layerId = "districts", id = 1 } };
        var (empty, emptyBody) = await Post("/api/analysis/within", new { area.sourceFeature, types = Array.Empty<string>() });
        var (unknown, _) = await Post("/api/analysis/buffer", new { geometry = Point(OLon, OLat), radiusMeters = Radius, types = new[] { "veteriner" } });
        var (notArray, _) = await Post("/api/analysis/within", new { area.sourceFeature, types = "hospital" });
        var (both, _) = await Post("/api/analysis/nearest", new { point = Point(OLon, OLat), n = 5, type = "hospital", types = new[] { "pharmacy" } });

        Assert.Equal(HttpStatusCode.BadRequest, empty);
        Assert.True(emptyBody.GetProperty("errors").TryGetProperty("types", out _));
        Assert.Equal(HttpStatusCode.BadRequest, unknown);
        Assert.Equal(HttpStatusCode.BadRequest, notArray);
        Assert.Equal(HttpStatusCode.BadRequest, both);
    }

    [Theory]
    [InlineData(0, "n")]
    [InlineData(101, "n")]
    public async Task Nearest_rejects_out_of_range_n(int n, string field)
    {
        var (status, body) = await Post("/api/analysis/nearest", new { point = Point(OLon, OLat), n });
        Assert.Equal(HttpStatusCode.BadRequest, status);
        Assert.True(body.GetProperty("errors").TryGetProperty(field, out _));
    }

    [Fact]
    public async Task Nearest_rejects_reversed_coordinates_and_non_point_input()
    {
        var (reversed, _) = await Post("/api/analysis/nearest", new { point = Point(OLat, OLon), n = 5 });
        var (line, _) = await Post("/api/analysis/nearest", new { point = new { type = "LineString", coordinates = new[] { new[] { 29.3, 40.3 }, new[] { 29.31, 40.3 } } }, n = 5 });

        Assert.Equal(HttpStatusCode.UnprocessableEntity, reversed);
        Assert.Equal(HttpStatusCode.UnprocessableEntity, line);
    }

    // ---------------- A01: alan içinde ----------------

    [Fact]
    public async Task Within_district_respects_hole_and_boundary_policy()
    {
        var districtA = await Sql.ScalarAsync<long>(_cs, "SELECT id FROM districts WHERE source_id = 1 AND source = 'osm'");

        var (_, inclusive) = await Post("/api/analysis/within", new { sourceFeature = new { layerId = "districts", id = districtA } });
        var (_, exclusive) = await Post("/api/analysis/within", new { sourceFeature = new { layerId = "districts", id = districtA }, includeBoundary = false });

        // Fixture: node 10/15 içeride, node 12 ortak sınırda, node 11 delikte.
        Assert.Equal(["Sentetik Hastanesi", "Sentetik Hastanesi", "Sınırdaki Klinik"], Names(inclusive).Order());
        Assert.Equal(["Sentetik Hastanesi", "Sentetik Hastanesi"], Names(exclusive).Order());
        Assert.DoesNotContain("Delikteki Eczane", Names(inclusive));
        Assert.Equal("ST_Covers(alan, tesis)", inclusive.GetProperty("parameters").GetProperty("predicate").GetString());
        Assert.Equal("MultiPolygon", inclusive.GetProperty("input").GetProperty("geometry").GetProperty("type").GetString());
    }

    [Fact]
    public async Task Within_multipolygon_includes_features_in_every_part()
    {
        var id = await Sql.ScalarAsync<long>(_cs, "SELECT id FROM districts WHERE source_id = 900");
        var (_, body) = await Post("/api/analysis/within", new { sourceFeature = new { layerId = "districts", id } });

        Assert.Contains("İkinci parçada", Names(body));
        Assert.Contains("Kaynak", Names(body));
        Assert.DoesNotContain("Kuzey 1990", Names(body)); // ilk parça 40.29-40.31 dışında
    }

    [Fact]
    public async Task Within_drawn_polygon_and_user_polygon_source()
    {
        var square = new
        {
            type = "Polygon",
            // 29.285-29.315 boylam: ±0.01 noktaları içeride, Doğu 0.02 (29.32) dışarıda; 40.295-40.305 enlem: Kuzey noktaları dışarıda.
            coordinates = new[] { new[] { new[] { 29.285, 40.295 }, new[] { 29.315, 40.295 }, new[] { 29.315, 40.305 }, new[] { 29.285, 40.305 }, new[] { 29.285, 40.295 } } },
        };
        var (status, drawn) = await Post("/api/analysis/within", new { geometry = square });
        Assert.Equal(HttpStatusCode.OK, status);
        Assert.Equal(["Aynı konum", "Batı 0.01", "Doğu 0.01", "Kaynak"], Names(drawn).Order());

        var created = await _client.PostAsync("/api/features", new StringContent(
            JsonSerializer.Serialize(new { type = "Feature", geometry = square, properties = new { name = "Analiz alanı" } }), Encoding.UTF8, "application/json"));
        var userId = JsonDocument.Parse(await created.Content.ReadAsStringAsync()).RootElement.GetProperty("id").GetString();
        var (_, fromUser) = await Post("/api/analysis/within", new { sourceFeature = new { layerId = "user-features", id = userId } });
        Assert.Equal(Names(drawn).Order(), Names(fromUser).Order());
    }

    [Fact]
    public async Task Within_rejects_point_sources_and_ambiguous_or_invalid_input()
    {
        var bowtie = new
        {
            type = "Polygon",
            coordinates = new[] { new[] { new[] { 29.29, 40.29 }, new[] { 29.31, 40.31 }, new[] { 29.31, 40.29 }, new[] { 29.29, 40.31 }, new[] { 29.29, 40.29 } } },
        };
        var (pointSource, _) = await Post("/api/analysis/within", new { sourceFeature = new { layerId = "facilities", id = _points["Kaynak"].Id } });
        var (both, _) = await Post("/api/analysis/within", new { sourceFeature = new { layerId = "districts", id = 1 }, geometry = bowtie });
        var (neither, _) = await Post("/api/analysis/within", new { includeBoundary = true });
        var (invalid, invalidBody) = await Post("/api/analysis/within", new { geometry = bowtie });
        var (missing, _) = await Post("/api/analysis/within", new { sourceFeature = new { layerId = "districts", id = 999_999 } });
        var (badId, _) = await Post("/api/analysis/within", new { sourceFeature = new { layerId = "user-features", id = "42" } });

        Assert.Equal(HttpStatusCode.UnprocessableEntity, pointSource);
        Assert.Equal(HttpStatusCode.BadRequest, both);
        Assert.Equal(HttpStatusCode.BadRequest, neither);
        Assert.Equal(HttpStatusCode.UnprocessableEntity, invalid);
        Assert.Contains("kendini kesiyor", invalidBody.GetProperty("errors").GetProperty("geometry")[0].GetString());
        Assert.Equal(HttpStatusCode.NotFound, missing);
        Assert.Equal(HttpStatusCode.BadRequest, badId);
    }

    [Fact]
    public async Task Analysis_rejects_unknown_fields_and_non_json()
    {
        var (status, body) = await Post("/api/analysis/nearest", new { point = Point(OLon, OLat), n = 5, sql = "DROP TABLE x" });
        Assert.Equal(HttpStatusCode.BadRequest, status);
        Assert.True(body.GetProperty("errors").TryGetProperty("sql", out _));

        var form = await _client.PostAsync("/api/analysis/nearest", new StringContent("n=5", Encoding.UTF8, "application/x-www-form-urlencoded"));
        Assert.Equal(HttpStatusCode.UnsupportedMediaType, form.StatusCode);
    }
}
