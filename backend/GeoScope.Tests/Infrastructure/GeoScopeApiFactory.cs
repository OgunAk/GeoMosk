using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;

namespace GeoScope.Tests.Infrastructure;

/// <param name="settings">Ek yapılandırma (ör. CORS izinli origin) — yalnız ilgili testte.</param>
public sealed class GeoScopeApiFactory(string connectionString, params (string Key, string Value)[] settings) : WebApplicationFactory<Program>
{
    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Testing");
        builder.UseSetting("ConnectionStrings:GeoScope", connectionString);
        foreach (var (key, value) in settings) builder.UseSetting(key, value);
    }
}
