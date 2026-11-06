using System.Net;
using System.Text.Json;
using GeoScope.Tests.Infrastructure;

namespace GeoScope.Tests.Api;

[Collection(PostGisCollection.Name)]
[Trait("Category", "Integration")]
public sealed class HealthEndpointTests(PostGisContainerFixture postgis)
{
    // Port 1'de dinleyen sunucu yok; bağlantı hızla reddedilir.
    private const string UnreachableDb = "Host=127.0.0.1;Port=1;Database=none;Username=none;Password=none;Timeout=2";

    [Fact]
    public async Task Ready_reports_postgis_version_when_database_is_available()
    {
        await using var factory = new GeoScopeApiFactory(postgis.ConnectionString);
        using var client = factory.CreateClient();

        var response = await client.GetAsync("/api/health/ready");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        using var json = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        Assert.Equal("Healthy", json.RootElement.GetProperty("status").GetString());
        var check = Assert.Single(json.RootElement.GetProperty("checks").EnumerateArray());
        Assert.Equal("postgis", check.GetProperty("name").GetString());
        Assert.StartsWith("3.5", check.GetProperty("data").GetProperty("postgisVersion").GetString());
    }

    [Fact]
    public async Task Ready_returns_503_without_leaking_connection_details_when_database_is_unreachable()
    {
        await using var factory = new GeoScopeApiFactory(UnreachableDb);
        using var client = factory.CreateClient();

        var response = await client.GetAsync("/api/health/ready");
        var body = await response.Content.ReadAsStringAsync();

        Assert.Equal(HttpStatusCode.ServiceUnavailable, response.StatusCode);
        Assert.Contains("Unhealthy", body);
        Assert.DoesNotContain("127.0.0.1", body);
        Assert.DoesNotContain("Password", body, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task Live_is_healthy_even_when_database_is_unreachable()
    {
        await using var factory = new GeoScopeApiFactory(UnreachableDb);
        using var client = factory.CreateClient();

        var response = await client.GetAsync("/api/health/live");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Fact]
    public async Task OpenApi_document_is_served()
    {
        await using var factory = new GeoScopeApiFactory(postgis.ConnectionString);
        using var client = factory.CreateClient();

        var response = await client.GetAsync("/openapi/v1.json");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        // Görünen ad GeoMosk (ADR-0017); derleme adı GeoScope.Api başlığa sızmaz.
        using var doc = System.Text.Json.JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        Assert.Equal("GeoMosk API", doc.RootElement.GetProperty("info").GetProperty("title").GetString());
    }

    [Fact]
    public async Task Unknown_api_route_returns_problem_details()
    {
        await using var factory = new GeoScopeApiFactory(postgis.ConnectionString);
        using var client = factory.CreateClient();

        var response = await client.GetAsync("/api/does-not-exist");

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
        Assert.Equal("application/problem+json", response.Content.Headers.ContentType?.MediaType);
    }
}
