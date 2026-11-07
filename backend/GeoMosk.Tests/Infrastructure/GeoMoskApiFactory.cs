using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;

namespace GeoMosk.Tests.Infrastructure;

/// <param name="settings">Ek yapılandırma (ör. CORS izinli origin) — yalnız ilgili testte.</param>
public sealed class GeoMoskApiFactory(string connectionString, params (string Key, string Value)[] settings) : WebApplicationFactory<Program>
{
    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Testing");
        builder.UseSetting("ConnectionStrings:GeoMosk", connectionString);
        foreach (var (key, value) in settings) builder.UseSetting(key, value);
    }
}
