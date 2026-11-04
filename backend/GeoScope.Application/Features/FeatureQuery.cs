using System.Globalization;

namespace GeoScope.Application.Features;

/// <summary>EPSG:4326 sınırlayıcı kutu. Tarih çizgisini aşan kutu (minLon &gt; maxLon) desteklenmez.</summary>
public sealed record BoundingBox(double MinLon, double MinLat, double MaxLon, double MaxLat);

public sealed record FeatureQuery(BoundingBox? Bbox, int Limit, int Offset);

public sealed class FeatureListOptions
{
    public const string SectionName = "FeatureList";
    public int DefaultLimit { get; init; } = 250;
    public int MaxLimit { get; init; } = 2000;
}

public static class FeatureQueryParser
{
    /// <summary>Sorgu parametrelerini doğrular; hata varsa alan adı → mesajlar döner.</summary>
    public static (FeatureQuery? Query, Dictionary<string, string[]> Errors) Parse(
        string? bbox, int? limit, int? offset, FeatureListOptions options)
    {
        var errors = new Dictionary<string, string[]>();

        var effectiveLimit = limit ?? options.DefaultLimit;
        if (effectiveLimit < 1 || effectiveLimit > options.MaxLimit)
            errors["limit"] = [$"limit 1 ile {options.MaxLimit} arasında olmalı."];

        var effectiveOffset = offset ?? 0;
        if (effectiveOffset < 0)
            errors["offset"] = ["offset negatif olamaz."];

        BoundingBox? box = null;
        if (!string.IsNullOrWhiteSpace(bbox))
        {
            var error = TryParseBbox(bbox, out box);
            if (error is not null) errors["bbox"] = [error];
        }

        return errors.Count > 0 ? (null, errors) : (new FeatureQuery(box, effectiveLimit, effectiveOffset), errors);
    }

    private static string? TryParseBbox(string raw, out BoundingBox? box)
    {
        box = null;
        var parts = raw.Split(',');
        if (parts.Length != 4)
            return "bbox biçimi: minLon,minLat,maxLon,maxLat (EPSG:4326).";

        var values = new double[4];
        for (var i = 0; i < 4; i++)
        {
            if (!double.TryParse(parts[i].Trim(), NumberStyles.Float, CultureInfo.InvariantCulture, out values[i])
                || !double.IsFinite(values[i]))
                return "bbox değerleri sonlu ondalık sayılar olmalı (nokta ayraçlı).";
        }

        var (minLon, minLat, maxLon, maxLat) = (values[0], values[1], values[2], values[3]);
        if (minLon < -180 || maxLon > 180 || minLat < -90 || maxLat > 90)
            return "bbox boylam [-180,180], enlem [-90,90] aralığında olmalı.";
        if (minLon >= maxLon)
            return "minLon maxLon'dan küçük olmalı; tarih çizgisini aşan bbox desteklenmez.";
        if (minLat >= maxLat)
            return "minLat maxLat'tan küçük olmalı.";

        box = new BoundingBox(minLon, minLat, maxLon, maxLat);
        return null;
    }
}
