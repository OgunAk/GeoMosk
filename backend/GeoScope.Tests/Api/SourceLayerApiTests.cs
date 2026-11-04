using System.Net;
using System.Text.Json;
using GeoScope.Tests.Infrastructure;

namespace GeoScope.Tests.Api;

[Collection(PostGisCollection.Name)]
[Trait("Category", "Integration")]
public sealed class SourceLayerApiTests(PostGisContainerFixture postgis) : IAsyncLifetime
{
    private GeoScopeApiFactory _factory = null!;
    private HttpClient _client = null!;

    public async Task InitializeAsync()
    {
        var cs = await postgis.CreateMigratedDatabaseAsync("api_source_layers");
        var (exit, _, stderr) = await ImportRunner.RunAsync(ImportRunner.Fixture("v2"), cs);
        Assert.True(exit == 0, stderr);
        _factory = new GeoScopeApiFactory(cs);
        _client = _factory.CreateClient();
    }

    public async Task DisposeAsync()
    {
        _client.Dispose();
        await _factory.DisposeAsync();
    }

    private async Task<JsonElement> GetCollection(string url)
    {
        var response = await _client.GetAsync(url);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal("application/geo+json", response.Content.Headers.ContentType?.MediaType);
        return JsonDocument.Parse(await response.Content.ReadAsStringAsync()).RootElement;
    }

    [Fact]
    public async Task Districts_are_returned_as_rfc7946_feature_collection_in_lon_lat_order()
    {
        var json = await GetCollection("/api/districts");

        Assert.Equal("FeatureCollection", json.GetProperty("type").GetString());
        var features = json.GetProperty("features");
        Assert.Equal(2, features.GetArrayLength());
        var first = features[0];
        Assert.Equal("Feature", first.GetProperty("type").GetString());
        Assert.Equal("MultiPolygon", first.GetProperty("geometry").GetProperty("type").GetString());
        Assert.False(json.TryGetProperty("crs", out _));
        // [boylam, enlem]: fixture boylam 29.x, enlem 40.x
        var coord = first.GetProperty("geometry").GetProperty("coordinates")[0][0][0];
        Assert.InRange(coord[0].GetDouble(), 29.0, 29.2);
        Assert.InRange(coord[1].GetDouble(), 40.0, 40.1);
        Assert.Equal("Sentetik İlçe A", first.GetProperty("properties").GetProperty("name").GetString());
    }

    [Fact]
    public async Task Facilities_exclude_records_removed_from_source()
    {
        var json = await GetCollection("/api/facilities");

        var sourceIds = json.GetProperty("features").EnumerateArray()
            .Select(f => f.GetProperty("properties").GetProperty("osmId").GetInt64()).ToList();
        Assert.Equal(5, sourceIds.Count);
        Assert.DoesNotContain(13L, sourceIds); // v2'de kaldırıldı
    }

    [Fact]
    public async Task Bbox_filter_returns_only_intersecting_features()
    {
        var json = await GetCollection("/api/districts?bbox=29.15,40.02,29.19,40.08");

        var names = json.GetProperty("features").EnumerateArray()
            .Select(f => f.GetProperty("properties").GetProperty("name").GetString()).ToList();
        Assert.Equal(["Sentetik İlçe B"], names);
    }

    [Fact]
    public async Task Bbox_inside_a_hole_does_not_return_the_district()
    {
        // ST_Intersects gerçek geometriyi kullanır; yalnızca zarf karşılaştırması olsaydı delik içindeki kutu ilçe A'yı döndürürdü.
        var json = await GetCollection("/api/districts?bbox=29.045,40.045,29.055,40.055");
        Assert.Equal(0, json.GetProperty("features").GetArrayLength());
    }

    [Fact]
    public async Task Pagination_reports_partial_results_and_is_stable()
    {
        var page1 = await GetCollection("/api/facilities?limit=2&offset=0");
        var page2 = await GetCollection("/api/facilities?limit=2&offset=2");

        Assert.True(page1.GetProperty("meta").GetProperty("hasMore").GetBoolean());
        Assert.Equal(2, page1.GetProperty("meta").GetProperty("returned").GetInt32());
        var ids1 = page1.GetProperty("features").EnumerateArray().Select(f => f.GetProperty("id").GetInt64());
        var ids2 = page2.GetProperty("features").EnumerateArray().Select(f => f.GetProperty("id").GetInt64());
        Assert.Empty(ids1.Intersect(ids2));
        Assert.True(ids1.Max() < ids2.Min());
    }

    [Theory]
    [InlineData("/api/facilities?bbox=29,40,29.1", "bbox")]
    [InlineData("/api/facilities?bbox=40,29,40.1,29.1&limit=5", null)] // ters sıra yine geçerli bir kutudur; boş sonuç
    [InlineData("/api/facilities?bbox=29.2,40,29.1,40.1", "bbox")]     // minLon > maxLon (tarih çizgisi) reddedilir
    [InlineData("/api/facilities?bbox=29,40,200,40.1", "bbox")]
    [InlineData("/api/facilities?bbox=29;40;29.1;40.1", "bbox")]
    [InlineData("/api/facilities?limit=0", "limit")]
    [InlineData("/api/facilities?limit=2001", "limit")]
    [InlineData("/api/facilities?offset=-1", "offset")]
    public async Task Invalid_query_parameters_return_validation_problem(string url, string? errorField)
    {
        var response = await _client.GetAsync(url);
        if (errorField is null)
        {
            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
            return;
        }

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal("application/problem+json", response.Content.Headers.ContentType?.MediaType);
        var body = await response.Content.ReadAsStringAsync();
        using var json = JsonDocument.Parse(body);
        Assert.True(json.RootElement.GetProperty("errors").TryGetProperty(errorField, out _), body);
        Assert.True(json.RootElement.TryGetProperty("traceId", out _), body);
    }

    [Fact]
    public async Task OpenApi_describes_geometry_as_geojson_object()
    {
        var doc = await _client.GetStringAsync("/openapi/v1.json");
        Assert.Contains("/api/districts", doc);
        Assert.Contains("RFC 7946 GeoJSON geometri", doc);
    }
}
