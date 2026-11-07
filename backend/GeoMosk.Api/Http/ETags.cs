using Microsoft.Extensions.Primitives;

namespace GeoMosk.Api.Http;

/// <summary>Sürüm ↔ güçlü ETag ("123"). Joker (*) desteklenmez: düzenleme her zaman bilinen bir sürüme karşı yapılır.</summary>
internal static class ETags
{
    public static string Format(uint version) => $"\"{version}\"";

    public static bool TryParseIfMatch(StringValues header, out uint version, out bool missing)
    {
        version = 0;
        missing = StringValues.IsNullOrEmpty(header);
        if (missing || header.Count != 1) return false;

        var value = header[0]!.Trim();
        if (value.StartsWith("W/", StringComparison.Ordinal)) value = value[2..];
        return value.Length >= 3 && value[0] == '"' && value[^1] == '"'
            && uint.TryParse(value.AsSpan(1, value.Length - 2), out version);
    }
}
