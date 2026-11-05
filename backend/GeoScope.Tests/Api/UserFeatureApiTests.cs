using System.Net;
using System.Text;
using System.Text.Json;
using GeoScope.Tests.Infrastructure;

namespace GeoScope.Tests.Api;

/// <summary>Faz 4: kullanıcı çizimleri CRUD'u (C02-C04) ve sunucu tarafı geometri doğrulaması, gerçek PostGIS ile.</summary>
[Collection(PostGisCollection.Name)]
[Trait("Category", "Integration")]
public sealed class UserFeatureApiTests(PostGisContainerFixture postgis) : IAsyncLifetime
{
    private GeoScopeApiFactory _factory = null!;
    private HttpClient _client = null!;
    private string _cs = "";

    // Bursa merkez civarı (çalışma alanı içinde), [boylam, enlem].
    private const string PointJson = """{"type":"Point","coordinates":[29.06,40.19]}""";
    private const string LineJson = """{"type":"LineString","coordinates":[[29.05,40.18],[29.07,40.20],[29.09,40.19]]}""";
    private const string PolygonJson = """{"type":"Polygon","coordinates":[[[29.0,40.1],[29.1,40.1],[29.1,40.2],[29.0,40.2],[29.0,40.1]]]}""";

    public async Task InitializeAsync()
    {
        _cs = await postgis.CreateMigratedDatabaseAsync("api_user_features");
        _factory = new GeoScopeApiFactory(_cs);
        _client = _factory.CreateClient();
    }

    public async Task DisposeAsync()
    {
        _client.Dispose();
        await _factory.DisposeAsync();
    }

    private static string FeatureBody(string geometry, string name = "Deneme çizimi", string? description = "Kullanıcı geometrisi") =>
        "{\"type\":\"Feature\",\"geometry\":" + geometry +
        ",\"properties\":{\"name\":" + JsonSerializer.Serialize(name) + ",\"description\":" + JsonSerializer.Serialize(description) + "}}";

    private Task<HttpResponseMessage> Post(string body) =>
        _client.PostAsync("/api/features", new StringContent(body, Encoding.UTF8, "application/json"));

    private async Task<HttpResponseMessage> Send(HttpMethod method, string url, string? body, string? ifMatch)
    {
        var request = new HttpRequestMessage(method, url);
        if (body is not null) request.Content = new StringContent(body, Encoding.UTF8, "application/json");
        if (ifMatch is not null) request.Headers.TryAddWithoutValidation("If-Match", ifMatch);
        return await _client.SendAsync(request);
    }

    private static async Task<JsonElement> Json(HttpResponseMessage r) => JsonDocument.Parse(await r.Content.ReadAsStringAsync()).RootElement;

    private async Task<(string Url, string ETag, JsonElement Body)> Create(string geometry, string name = "Deneme çizimi")
    {
        var response = await Post(FeatureBody(geometry, name));
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        return (response.Headers.Location!.ToString(), response.Headers.ETag!.Tag, await Json(response));
    }

    [Theory]
    [InlineData(PointJson, "Point")]
    [InlineData(LineJson, "LineString")]
    [InlineData(PolygonJson, "Polygon")]
    public async Task Create_stores_point_linestring_and_polygon_in_4326(string geometry, string expectedType)
    {
        var response = await Post(FeatureBody(geometry));

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        Assert.Equal("application/geo+json", response.Content.Headers.ContentType?.MediaType);
        Assert.NotEqual("\"0\"", response.Headers.ETag?.Tag);
        var body = await Json(response);
        var id = Guid.Parse(body.GetProperty("id").GetString()!);
        Assert.Equal($"/api/features/{id}", response.Headers.Location?.ToString());
        Assert.Equal(expectedType, body.GetProperty("geometry").GetProperty("type").GetString());
        Assert.Equal(expectedType, body.GetProperty("properties").GetProperty("geometryType").GetString());
        Assert.Equal("user-features", body.GetProperty("properties").GetProperty("layer").GetString());

        Assert.Equal(4326, await Sql.ScalarAsync<int>(_cs, "SELECT ST_SRID(geom) FROM user_features WHERE id = $1", id));
        Assert.Equal(expectedType.ToUpperInvariant(), await Sql.ScalarAsync<string>(_cs, "SELECT GeometryType(geom) FROM user_features WHERE id = $1", id));
    }

    [Fact]
    public async Task Coordinates_are_stored_as_lon_lat_and_kept_out_of_source_tables()
    {
        var (url, _, _) = await Create(PointJson);
        var id = Guid.Parse(url.Split('/').Last());

        Assert.Equal(29.06, await Sql.ScalarAsync<double>(_cs, "SELECT ST_X(geom) FROM user_features WHERE id = $1", id), 9);
        Assert.Equal(40.19, await Sql.ScalarAsync<double>(_cs, "SELECT ST_Y(geom) FROM user_features WHERE id = $1", id), 9);
        Assert.Equal(0, await Sql.ScalarAsync<int>(_cs, "SELECT count(*) FROM health_facilities"));
        Assert.Equal(0, await Sql.ScalarAsync<int>(_cs, "SELECT count(*) FROM districts"));
    }

    [Fact]
    public async Task Saved_feature_survives_an_api_restart()
    {
        var (url, etag, _) = await Create(PolygonJson, "Kalıcı alan");

        await using var restarted = new GeoScopeApiFactory(_cs);
        using var client = restarted.CreateClient();
        var response = await client.GetAsync(url);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal(etag, response.Headers.ETag?.Tag);
        Assert.Equal("Kalıcı alan", (await Json(response)).GetProperty("properties").GetProperty("name").GetString());
    }

    [Fact]
    public async Task List_returns_features_in_creation_order_as_feature_collection()
    {
        await Create(PointJson, "Birinci");
        await Create(LineJson, "İkinci");
        await Create(PolygonJson, "Üçüncü");

        var json = await Json(await _client.GetAsync("/api/features"));

        Assert.Equal("FeatureCollection", json.GetProperty("type").GetString());
        var names = json.GetProperty("features").EnumerateArray().Select(f => f.GetProperty("properties").GetProperty("name").GetString());
        Assert.Equal(["Birinci", "İkinci", "Üçüncü"], names);
        Assert.False(json.GetProperty("meta").GetProperty("hasMore").GetBoolean());
    }

    [Theory]
    [InlineData("""{"type":"MultiPoint","coordinates":[[29.06,40.19],[29.07,40.2]]}""", "Desteklenmeyen")]
    [InlineData("""{"type":"GeometryCollection","geometries":[{"type":"Point","coordinates":[29.06,40.19]}]}""", "Desteklenmeyen")]
    [InlineData("""{"type":"Polygon","coordinates":[[[29.0,40.1],[29.1,40.1],[29.1,40.2],[29.0,40.2]]]}""", "kapalı")]
    [InlineData("""{"type":"Polygon","coordinates":[[[29.0,40.1],[29.1,40.2],[29.1,40.1],[29.0,40.2],[29.0,40.1]]]}""", "kendini kesiyor")]
    [InlineData("""{"type":"Point","coordinates":[40.19,29.06]}""", "çalışma alanı")]          // ters koordinat sırası
    [InlineData("""{"type":"Point","coordinates":[29.06,40.19,100]}""", "2 boyutlu")]
    [InlineData("""{"type":"Point","coordinates":[200,40.19]}""", "aralığında")]
    [InlineData("""{"type":"LineString","coordinates":[[29.06,40.19]]}""", "en az 2")]
    [InlineData("""{"type":"LineString","coordinates":[[29.06,40.19],[29.06,40.19]]}""", "farklı nokta")]
    [InlineData("""{"type":"Point","coordinates":[29.06,40.19],"crs":{"type":"name","properties":{"name":"EPSG:3857"}}}""", "crs")]
    public async Task Semantically_invalid_geometry_is_rejected_with_422_and_not_stored(string geometry, string expectedMessage)
    {
        var response = await Post(FeatureBody(geometry));

        Assert.Equal(HttpStatusCode.UnprocessableEntity, response.StatusCode);
        Assert.Equal("application/problem+json", response.Content.Headers.ContentType?.MediaType);
        var json = await Json(response);
        Assert.Contains(expectedMessage, json.GetProperty("errors").GetProperty("geometry")[0].GetString());
        Assert.True(json.TryGetProperty("traceId", out _));
        Assert.Equal(0, await Sql.ScalarAsync<int>(_cs, "SELECT count(*) FROM user_features"));
    }

    [Fact]
    public async Task Too_many_vertices_is_rejected_with_422()
    {
        var coords = string.Join(',', Enumerable.Range(0, 10_001).Select(i => $"[{29.0 + i * 0.00001:0.00000},40.1]"));
        var response = await Post(FeatureBody("{\"type\":\"LineString\",\"coordinates\":[" + coords + "]}"));

        Assert.Equal(HttpStatusCode.UnprocessableEntity, response.StatusCode);
        Assert.Contains("10000", (await Json(response)).GetProperty("errors").GetProperty("geometry")[0].GetString());
    }

    [Theory]
    [InlineData("""{"type":"Feature","geometry":{"type":"Point","coordinates":"29,40"},"properties":{"name":"Test"}}""", "geometry")]
    [InlineData("""{"type":"Feature","properties":{"name":"Test"}}""", "geometry")]
    [InlineData("""{"type":"Feature","geometry":{"type":"Point","coordinates":[29.06,40.19]},"properties":{}}""", "name")]
    [InlineData("""{"type":"Feature","geometry":{"type":"Point","coordinates":[29.06,40.19]},"properties":{"name":"  "}}""", "name")]
    [InlineData("""{"type":"Feature","geometry":{"type":"Point","coordinates":[29.06,40.19]},"properties":{"name":"Test","color":"red"}}""", "properties.color")]
    [InlineData("""{"type":"Feature","id":"abc","geometry":{"type":"Point","coordinates":[29.06,40.19]},"properties":{"name":"Test"}}""", "id")]
    [InlineData("""{"type":"Feature","geometry":{"type":"Point","coordinates":[29.06,40.19]},"properties":{"name":"ab"}}""", "name")]
    [InlineData("""{"type":"Feature","geometry":{"type":"Point","coordinates":[29.06,40.19]},"properties":{"name":"  ab  "}}""", "name")]
    [InlineData("""{"type":"Point","coordinates":[29.06,40.19]}""", "type")]
    [InlineData("""[1,2,3]""", "")]
    public async Task Malformed_create_body_is_rejected_with_400(string body, string field)
    {
        var response = await Post(body);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.True((await Json(response)).GetProperty("errors").TryGetProperty(field, out _));
    }

    [Fact]
    public async Task Name_needs_at_least_three_characters_after_trimming()
    {
        var created = await Post("""{"type":"Feature","geometry":{"type":"Point","coordinates":[29.06,40.19]},"properties":{"name":"  Çağ  "}}""");
        Assert.Equal(HttpStatusCode.Created, created.StatusCode);
        Assert.Equal("Çağ", (await Json(created)).GetProperty("properties").GetProperty("name").GetString());

        var tooShort = await Post("""{"type":"Feature","geometry":{"type":"Point","coordinates":[29.06,40.19]},"properties":{"name":"ab"}}""");
        Assert.Contains("en az 3 karakter", (await Json(tooShort)).GetProperty("errors").GetProperty("name")[0].GetString());

        // PATCH: kısa ad 400, kayıt değişmez.
        var (url, etag, _) = await Create(PointJson, "Uzun ad");
        var patch = await Send(HttpMethod.Patch, url, """{"name":" x "}""", etag);
        Assert.Equal(HttpStatusCode.BadRequest, patch.StatusCode);
        Assert.Equal("Uzun ad", (await Json(await _client.GetAsync(url))).GetProperty("properties").GetProperty("name").GetString());
    }

    [Fact]
    public async Task Invalid_json_text_is_rejected_with_400()
    {
        Assert.Equal(HttpStatusCode.BadRequest, (await Post("""{"type":"Feature",""")).StatusCode);
    }

    [Fact]
    public async Task Patch_updates_name_and_geometry_atomically_and_bumps_version()
    {
        var (url, etag, _) = await Create(PointJson);

        var response = await Send(HttpMethod.Patch, url,
            """{"name":"Taşındı","description":null,"geometry":{"type":"Point","coordinates":[29.1,40.2]}}""", etag);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.NotEqual(etag, response.Headers.ETag?.Tag);
        var props = (await Json(response)).GetProperty("properties");
        Assert.Equal("Taşındı", props.GetProperty("name").GetString());
        Assert.Equal(JsonValueKind.Null, props.GetProperty("description").ValueKind);
        var id = Guid.Parse(url.Split('/').Last());
        Assert.Equal(29.1, await Sql.ScalarAsync<double>(_cs, "SELECT ST_X(geom) FROM user_features WHERE id = $1", id), 9);
    }

    [Fact]
    public async Task Patch_with_invalid_geometry_returns_422_and_changes_nothing()
    {
        var (url, etag, _) = await Create(PolygonJson, "Eski ad");

        var response = await Send(HttpMethod.Patch, url,
            """{"name":"Yeni ad","geometry":{"type":"Polygon","coordinates":[[[29.0,40.1],[29.1,40.2],[29.1,40.1],[29.0,40.2],[29.0,40.1]]]}}""", etag);

        // Ad geçerli olsa da geometri hatası tüm isteği reddeder (atomik); hata yalnız geometride olduğu için 422.
        Assert.Equal(HttpStatusCode.UnprocessableEntity, response.StatusCode);
        var current = await _client.GetAsync(url);
        Assert.Equal(etag, current.Headers.ETag?.Tag);
        Assert.Equal("Eski ad", (await Json(current)).GetProperty("properties").GetProperty("name").GetString());
    }

    [Theory]
    [InlineData("""{"geometry":null}""", "geometry")]
    [InlineData("""{"name":null}""", "name")]
    [InlineData("""{"layer":"districts"}""", "layer")]
    [InlineData("""{}""", "")]
    public async Task Patch_rejects_invalid_fields_with_400(string body, string field)
    {
        var (url, etag, _) = await Create(PointJson);
        var response = await Send(HttpMethod.Patch, url, body, etag);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.True((await Json(response)).GetProperty("errors").TryGetProperty(field, out _));
    }

    [Fact]
    public async Task Patch_with_stale_version_returns_412_and_missing_if_match_returns_428()
    {
        var (url, etag, _) = await Create(PointJson, "Orijinal");
        Assert.Equal(HttpStatusCode.OK, (await Send(HttpMethod.Patch, url, """{"name":"Birinci düzenleme"}""", etag)).StatusCode);

        var stale = await Send(HttpMethod.Patch, url, """{"name":"Eski sürümden"}""", etag);
        var missing = await Send(HttpMethod.Patch, url, """{"name":"Test"}""", ifMatch: null);

        Assert.Equal(HttpStatusCode.PreconditionFailed, stale.StatusCode);
        Assert.Equal(HttpStatusCode.PreconditionRequired, missing.StatusCode);
        Assert.Equal("Birinci düzenleme", (await Json(await _client.GetAsync(url))).GetProperty("properties").GetProperty("name").GetString());
    }

    [Fact]
    public async Task Delete_requires_current_version_and_then_returns_404()
    {
        var (url, etag, _) = await Create(LineJson);
        var updated = await Send(HttpMethod.Patch, url, """{"description":"değişti"}""", etag);
        var currentEtag = updated.Headers.ETag!.Tag;

        Assert.Equal(HttpStatusCode.PreconditionRequired, (await Send(HttpMethod.Delete, url, null, null)).StatusCode);
        Assert.Equal(HttpStatusCode.PreconditionFailed, (await Send(HttpMethod.Delete, url, null, etag)).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await _client.GetAsync(url)).StatusCode); // eski sürümle silinmedi

        Assert.Equal(HttpStatusCode.NoContent, (await Send(HttpMethod.Delete, url, null, currentEtag)).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await _client.GetAsync(url)).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await Send(HttpMethod.Delete, url, null, currentEtag)).StatusCode);
    }

    [Fact]
    public async Task Unknown_id_returns_404_and_non_guid_route_does_not_match()
    {
        Assert.Equal(HttpStatusCode.NotFound, (await _client.GetAsync($"/api/features/{Guid.NewGuid()}")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await _client.GetAsync("/api/features/123")).StatusCode);
        var patch = await Send(HttpMethod.Patch, $"/api/features/{Guid.NewGuid()}", """{"name":"Test"}""", "\"1\"");
        Assert.Equal(HttpStatusCode.NotFound, patch.StatusCode);
    }

    [Fact]
    public async Task Database_constraint_is_a_second_line_of_defence()
    {
        // API doğrulamasını atlayan doğrudan yazım da DB CHECK'leriyle reddedilir (Multi* tip, geçersiz şekil).
        await Assert.ThrowsAsync<Npgsql.PostgresException>(() => Sql.ExecAsync(_cs,
            "INSERT INTO user_features (name, geom) VALUES ('x', ST_GeomFromEWKT('SRID=4326;MULTIPOINT((29 40),(29.1 40.1))'))"));
    }
}
