using System.Net;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using GeoMosk.Tests.Infrastructure;

namespace GeoMosk.Tests.Api;

/// <summary>Faz 3: katman kataloğu, tekil Feature, arama/filtre ve yerel ad/açıklama düzenleme (PATCH + If-Match).</summary>
[Collection(PostGisCollection.Name)]
[Trait("Category", "Integration")]
public sealed class SourceFeatureDetailAndEditTests(PostGisContainerFixture postgis) : IAsyncLifetime
{
    private GeoMoskApiFactory _factory = null!;
    private HttpClient _client = null!;
    private string _cs = "";

    public async Task InitializeAsync()
    {
        _cs = await postgis.CreateMigratedDatabaseAsync("api_detail_edit");
        var (exit, _, stderr) = await ImportRunner.RunAsync(ImportRunner.Fixture("v2"), _cs);
        Assert.True(exit == 0, stderr);
        _factory = new GeoMoskApiFactory(_cs);
        _client = _factory.CreateClient();
    }

    public async Task DisposeAsync()
    {
        _client.Dispose();
        await _factory.DisposeAsync();
    }

    private Task<long> DistrictId(long osmId) =>
        Sql.ScalarAsync<long>(_cs, "SELECT id FROM districts WHERE source_id = $1", osmId);

    private Task<long> FacilityId(long osmId) =>
        Sql.ScalarAsync<long>(_cs, "SELECT id FROM health_facilities WHERE source_id = $1", osmId);

    private static async Task<JsonElement> Json(HttpResponseMessage response) =>
        JsonDocument.Parse(await response.Content.ReadAsStringAsync()).RootElement;

    private async Task<HttpResponseMessage> Patch(string url, string json, string? ifMatch)
    {
        var request = new HttpRequestMessage(HttpMethod.Patch, url) { Content = new StringContent(json, Encoding.UTF8, "application/json") };
        if (ifMatch is not null) request.Headers.TryAddWithoutValidation("If-Match", ifMatch);
        return await _client.SendAsync(request);
    }

    private async Task<string[]> Names(string url)
    {
        var json = await Json(await _client.GetAsync(url));
        return json.GetProperty("features").EnumerateArray()
            .Select(f => f.GetProperty("properties").GetProperty("name").GetString()!).ToArray();
    }

    [Fact]
    public async Task Layers_catalog_lists_both_source_layers_with_counts()
    {
        var json = await Json(await _client.GetAsync("/api/layers"));

        var layers = json.EnumerateArray().ToDictionary(l => l.GetProperty("id").GetString()!);
        Assert.Equal(2, layers["districts"].GetProperty("featureCount").GetInt32());
        Assert.Equal(5, layers["facilities"].GetProperty("featureCount").GetInt32()); // v2: node 13 kaynaktan kalktı
        Assert.Equal("MultiPolygon", layers["districts"].GetProperty("geometryType").GetString());
        Assert.Contains("OpenStreetMap", layers["facilities"].GetProperty("attribution").GetString());
    }

    [Fact]
    public async Task Facility_detail_includes_source_tags_district_and_etag()
    {
        var response = await _client.GetAsync($"/api/facilities/{await FacilityId(20)}");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal("\"0\"", response.Headers.ETag?.Tag);
        var props = (await Json(response)).GetProperty("properties");
        Assert.Equal("clinic", props.GetProperty("tags").GetProperty("amenity").GetString());
        Assert.Equal("Sentetik İlçe B", props.GetProperty("districtName").GetString());
        Assert.True(props.GetProperty("representativePoint").GetBoolean());
        Assert.Equal("https://www.openstreetmap.org/way/20", props.GetProperty("osmUrl").GetString());
    }

    [Fact]
    public async Task Unknown_or_removed_feature_returns_404_problem()
    {
        // node 13 v1'de var, v2'de kaynaktan kalkıyor: önce v1 sonra v2 import edilerek "silinmiş işaretli" kayıt oluşur.
        Assert.Equal(0, (await ImportRunner.RunAsync(ImportRunner.Fixture("v1"), _cs)).ExitCode);
        Assert.Equal(0, (await ImportRunner.RunAsync(ImportRunner.Fixture("v2"), _cs)).ExitCode);
        var missing = await _client.GetAsync("/api/districts/999999");
        var removed = await _client.GetAsync($"/api/facilities/{await FacilityId(13)}"); // v2'de kaynaktan kalktı

        Assert.Equal(HttpStatusCode.NotFound, missing.StatusCode);
        Assert.Equal("application/problem+json", missing.Content.Headers.ContentType?.MediaType);
        Assert.Equal(HttpStatusCode.NotFound, removed.StatusCode);
    }

    [Theory]
    [InlineData("/api/districts?q=ilce", new[] { "Sentetik İlçe A", "Sentetik İlçe B" })]  // İ→i, ç→c
    [InlineData("/api/districts?q=İLÇE%20b", new[] { "Sentetik İlçe B" })]
    [InlineData("/api/facilities?q=SINIRDAKI", new[] { "Sınırdaki Klinik" })]               // ı→i, büyük harf
    [InlineData("/api/facilities?q=hastanesi&type=hospital", new[] { "Sentetik Devlet Hastanesi", "Sentetik Hastanesi" })]
    [InlineData("/api/facilities?q=%25", new string[0])]                                     // % kaçışlanır, joker değil
    [InlineData("/api/facilities?q=_", new string[0])]
    public async Task Search_is_case_and_turkish_accent_insensitive(string url, string[] expected)
    {
        Assert.Equal(expected.Order(), (await Names(url)).Order());
    }

    [Theory]
    [InlineData("x' OR '1'='1")]
    [InlineData("'; DROP TABLE health_facilities; --")]
    [InlineData("\'); SELECT pg_sleep(5); --")]
    public async Task Search_treats_sql_injection_payloads_as_plain_text(string payload)
    {
        // Parametreli sorgu: yük metin olarak aranır, eşleşme yok, tablo yerinde ve istek hızlı döner.
        var before = await Sql.ScalarAsync<long>(_cs, "SELECT count(*) FROM health_facilities");
        var started = System.Diagnostics.Stopwatch.StartNew();
        foreach (var layer in new[] { "facilities", "districts" })
        {
            var response = await _client.GetAsync($"/api/{layer}?q={Uri.EscapeDataString(payload)}");
            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
            Assert.Empty((await Json(response)).GetProperty("features").EnumerateArray());
        }
        Assert.True(started.Elapsed < TimeSpan.FromSeconds(4), "pg_sleep çalışmış olmamalı");
        Assert.Equal(before, await Sql.ScalarAsync<long>(_cs, "SELECT count(*) FROM health_facilities"));
    }

    [Fact]
    public async Task District_filter_uses_boundary_inclusive_coverage()
    {
        // İlçe A: node 10, 15 içeride; node 12 ortak sınırda (dahil); node 11 delikte (hariç).
        var inA = await Names($"/api/facilities?districtId={await DistrictId(1)}");
        Assert.Equal(["Sentetik Devlet Hastanesi", "Sentetik Hastanesi", "Sınırdaki Klinik"], inA.Order());
        var inB = await Names($"/api/facilities?districtId={await DistrictId(2)}");
        Assert.Equal(["Alan Klinik", "Sınırdaki Klinik"], inB.Order());
    }

    [Theory]
    [InlineData("/api/facilities?type=hastane", "type")]
    [InlineData("/api/facilities?districtId=0", "districtId")]
    public async Task Invalid_filters_return_validation_problem(string url, string field)
    {
        var response = await _client.GetAsync(url);
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.True((await Json(response)).GetProperty("errors").TryGetProperty(field, out _));
    }

    [Fact]
    public async Task Too_long_search_text_is_rejected()
    {
        var response = await _client.GetAsync($"/api/districts?q={new string('a', 101)}");
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task Patch_sets_local_name_keeps_source_name_and_reverts_with_null()
    {
        var id = await DistrictId(1);
        var url = $"/api/districts/{id}";

        var first = await Patch(url, """{"name":"Yerel İlçe Adı","description":"Demo notu"}""", "\"0\"");
        Assert.Equal(HttpStatusCode.OK, first.StatusCode);
        var etag = first.Headers.ETag!.Tag;
        Assert.NotEqual("\"0\"", etag);
        var props = (await Json(first)).GetProperty("properties");
        Assert.Equal("Yerel İlçe Adı", props.GetProperty("name").GetString());
        Assert.Equal("Sentetik İlçe A", props.GetProperty("sourceName").GetString());
        Assert.Equal("Demo notu", props.GetProperty("description").GetString());
        Assert.Equal(["Yerel İlçe Adı"], await Names("/api/districts?q=yerel"));

        // Yalnız name: null gönderilir → kaynak adına döner, açıklama değişmez.
        var revert = await Patch(url, """{"name":null}""", etag);
        Assert.Equal(HttpStatusCode.OK, revert.StatusCode);
        props = (await Json(revert)).GetProperty("properties");
        Assert.Equal("Sentetik İlçe A", props.GetProperty("name").GetString());
        Assert.Equal("Demo notu", props.GetProperty("description").GetString());

        // Kaynak tablosu hiç değişmedi.
        Assert.Equal("Sentetik İlçe A", await Sql.ScalarAsync<string>(_cs, "SELECT name FROM districts WHERE id = $1", id));
    }

    [Fact]
    public async Task Patch_with_stale_version_returns_412_and_does_not_overwrite()
    {
        var url = $"/api/facilities/{await FacilityId(12)}";
        Assert.Equal(HttpStatusCode.OK, (await Patch(url, """{"name":"İlk kullanıcı"}""", "\"0\"")).StatusCode);

        var stale = await Patch(url, """{"name":"İkinci kullanıcı"}""", "\"0\"");

        Assert.Equal(HttpStatusCode.PreconditionFailed, stale.StatusCode);
        Assert.Equal("application/problem+json", stale.Content.Headers.ContentType?.MediaType);
        Assert.Equal(["İlk kullanıcı"], await Names("/api/facilities?q=kullanici"));
    }

    [Fact]
    public async Task Patch_without_if_match_returns_428()
    {
        var response = await Patch($"/api/districts/{await DistrictId(1)}", """{"name":"x"}""", ifMatch: null);
        Assert.Equal(HttpStatusCode.PreconditionRequired, response.StatusCode);
    }

    [Theory]
    [InlineData("""{"geom":{"type":"Point","coordinates":[29,40]}}""", "geom")]
    [InlineData("""{"name":"ok","osmId":5}""", "osmId")]
    [InlineData("""{"name":""}""", "name")]
    [InlineData("""{"name":5}""", "name")]
    [InlineData("""{"description":["x"]}""", "description")]
    [InlineData("""{}""", "")]
    public async Task Patch_rejects_protected_unknown_and_invalid_fields(string body, string field)
    {
        var response = await Patch($"/api/districts/{await DistrictId(1)}", body, "\"0\"");

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.True((await Json(response)).GetProperty("errors").TryGetProperty(field, out _));
        Assert.Equal(0, await Sql.ScalarAsync<int>(_cs, "SELECT count(*) FROM district_overrides"));
    }

    [Fact]
    public async Task Patch_rejects_too_long_name()
    {
        var body = JsonSerializer.Serialize(new { name = new string('a', 201) });
        var response = await Patch($"/api/districts/{await DistrictId(1)}", body, "\"0\"");
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task Patch_unknown_feature_returns_404()
    {
        var response = await Patch("/api/facilities/999999", """{"name":"x"}""", "\"0\"");
        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task Patch_requires_json_content_type()
    {
        var request = new HttpRequestMessage(HttpMethod.Patch, $"/api/districts/{await DistrictId(1)}")
        {
            Content = new StringContent("name=x", Encoding.UTF8, "application/x-www-form-urlencoded"),
        };
        request.Headers.TryAddWithoutValidation("If-Match", "\"0\"");

        var response = await _client.SendAsync(request);

        Assert.Equal(HttpStatusCode.UnsupportedMediaType, response.StatusCode);
    }

    [Fact]
    public async Task Html_in_names_is_stored_as_plain_text()
    {
        var url = $"/api/facilities/{await FacilityId(20)}";
        var response = await Patch(url, """{"name":"<img src=x onerror=alert(1)>"}""", "\"0\"");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        // API metni değiştirmeden döndürür; arayüz metin olarak render eder (HTML çalıştırmaz).
        Assert.Equal("<img src=x onerror=alert(1)>", (await Json(response)).GetProperty("properties").GetProperty("name").GetString());
        Assert.Equal(MediaTypeHeaderValue.Parse("application/geo+json; charset=utf-8").MediaType, response.Content.Headers.ContentType?.MediaType);
    }
}
