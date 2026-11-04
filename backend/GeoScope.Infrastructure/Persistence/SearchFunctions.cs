namespace GeoScope.Infrastructure.Persistence;

/// <summary>
/// SQL fonksiyonu <c>geoscope_search_normalize(text)</c> eşlemesi: <c>lower(unaccent(x))</c>.
/// unaccent önce Türkçe harfleri ASCII karşılığına indirir (İ→I, ı→i, ü→u, ş→s…), sonra lower uygulanır;
/// böylece "nilufer" → "Nilüfer", "izmir" → "İzmir" eşleşir. Yalnızca LINQ sorgusunda kullanılır.
/// </summary>
public static class SearchFunctions
{
    public const string SqlName = "geoscope_search_normalize";

    public static string? Normalize(string? value) =>
        throw new NotSupportedException("Yalnızca EF Core sorgularında (SQL) çalışır.");

    /// <summary>LIKE özel karakterlerini (\ % _) kaçışlar; desen kaçış karakteri '\'.</summary>
    public static string EscapeLike(string value) =>
        value.Replace("\\", "\\\\").Replace("%", "\\%").Replace("_", "\\_");
}
