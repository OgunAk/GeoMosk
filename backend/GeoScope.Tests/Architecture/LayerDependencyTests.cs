using System.Reflection;

namespace GeoScope.Tests.Architecture;

/// <summary>.claude/rules/architecture.md bağımlılık yönlerini derlenmiş referanslar üzerinden doğrular.</summary>
public sealed class LayerDependencyTests
{
    private static string[] GeoScopeReferencesOf(string assemblyName) =>
        Assembly.Load(assemblyName).GetReferencedAssemblies()
            .Select(a => a.Name!)
            .Where(n => n.StartsWith("GeoScope.", StringComparison.Ordinal))
            .ToArray();

    [Fact]
    public void Domain_depends_on_no_other_layer() =>
        Assert.Empty(GeoScopeReferencesOf("GeoScope.Domain"));

    [Fact]
    public void Application_does_not_depend_on_infrastructure_or_api()
    {
        var refs = GeoScopeReferencesOf("GeoScope.Application");
        Assert.DoesNotContain("GeoScope.Infrastructure", refs);
        Assert.DoesNotContain("GeoScope.Api", refs);
    }

    [Fact]
    public void Infrastructure_does_not_depend_on_api() =>
        Assert.DoesNotContain("GeoScope.Api", GeoScopeReferencesOf("GeoScope.Infrastructure"));
}
