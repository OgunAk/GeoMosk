using System.Reflection;

namespace GeoMosk.Tests.Architecture;

/// <summary>.claude/rules/architecture.md bağımlılık yönlerini derlenmiş referanslar üzerinden doğrular.</summary>
public sealed class LayerDependencyTests
{
    private static string[] GeoMoskReferencesOf(string assemblyName) =>
        Assembly.Load(assemblyName).GetReferencedAssemblies()
            .Select(a => a.Name!)
            .Where(n => n.StartsWith("GeoMosk.", StringComparison.Ordinal))
            .ToArray();

    [Fact]
    public void Domain_depends_on_no_other_layer() =>
        Assert.Empty(GeoMoskReferencesOf("GeoMosk.Domain"));

    [Fact]
    public void Application_does_not_depend_on_infrastructure_or_api()
    {
        var refs = GeoMoskReferencesOf("GeoMosk.Application");
        Assert.DoesNotContain("GeoMosk.Infrastructure", refs);
        Assert.DoesNotContain("GeoMosk.Api", refs);
    }

    [Fact]
    public void Infrastructure_does_not_depend_on_api() =>
        Assert.DoesNotContain("GeoMosk.Api", GeoMoskReferencesOf("GeoMosk.Infrastructure"));
}
