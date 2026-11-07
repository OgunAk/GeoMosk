using System.Globalization;
using GeoMosk.Domain.Facilities;

namespace GeoMosk.Application.Features;

/// <summary>EPSG:4326 sınırlayıcı kutu. Tarih çizgisini aşan kutu (minLon &gt; maxLon) desteklenmez.</summary>
public sealed record BoundingBox(double MinLon, double MinLat, double MaxLon, double MaxLat);

/// <summary>
/// Doğrulanmış liste sorgusu. <see cref="Q"/> görünen ad (override varsa o) üzerinde büyük/küçük harf ve
/// Türkçe aksan duyarsız "içerir" araması; <see cref="FacilityType"/> ve <see cref="DistrictId"/> yalnızca tesislerde.
/// Sayfalama id sırasıyladır: <see cref="After"/> (keyset, önerilen) bu id'den sonrakileri, <see cref="Offset"/> ilk N kaydı atlar.
/// </summary>
public sealed record FeatureQuery(
    BoundingBox? Bbox, int Limit, int Offset, string? Q = null, string? FacilityType = null, long? DistrictId = null, long? After = null);

/// <summary>Ham sorgu parametreleri (HTTP'den geldiği gibi).</summary>
public sealed record FeatureListRequest(
    string? Bbox, int? Limit, int? Offset, string? Q = null, string? Type = null, long? DistrictId = null, long? After = null);

public sealed class FeatureListOptions
{
    public const string SectionName = "FeatureList";
    public int DefaultLimit { get; init; } = 250;
    public int MaxLimit { get; init; } = 2000;
}

public static class FeatureQueryParser
{
    public const int MaxSearchLength = 100;

    /// <summary>Sorgu parametrelerini doğrular; hata varsa alan adı → mesajlar döner.</summary>
    public static (FeatureQuery? Query, Dictionary<string, string[]> Errors) Parse(FeatureListRequest request, FeatureListOptions options)
    {
        var (bbox, limit, offset) = (request.Bbox, request.Limit, request.Offset);
        var errors = new Dictionary<string, string[]>();

        var q = string.IsNullOrWhiteSpace(request.Q) ? null : request.Q.Trim();
        if (q is { Length: > MaxSearchLength })
            errors["q"] = [$"Arama metni en çok {MaxSearchLength} karakter olabilir."];

        var type = string.IsNullOrWhiteSpace(request.Type) ? null : request.Type.Trim();
        if (type is not null && !FacilityTypes.All.Contains(type))
            errors["type"] = [$"Geçersiz tesis türü. İzin verilenler: {string.Join(", ", FacilityTypes.All)}."];

        if (request.DistrictId is <= 0)
            errors["districtId"] = ["districtId pozitif olmalı."];

        var effectiveLimit = limit ?? options.DefaultLimit;
        if (effectiveLimit < 1 || effectiveLimit > options.MaxLimit)
            errors["limit"] = [$"limit 1 ile {options.MaxLimit} arasında olmalı."];

        var effectiveOffset = offset ?? 0;
        if (effectiveOffset < 0)
            errors["offset"] = ["offset negatif olamaz."];

        if (request.After is <= 0)
            errors["after"] = ["after pozitif bir id olmalı."];
        else if (request.After is not null && effectiveOffset > 0)
            errors["after"] = ["after ile offset birlikte kullanılamaz; keyset sayfalamada yalnız after verin."];

        BoundingBox? box = null;
        if (!string.IsNullOrWhiteSpace(bbox))
        {
            var error = TryParseBbox(bbox, out box);
            if (error is not null) errors["bbox"] = [error];
        }

        return errors.Count > 0
            ? (null, errors)
            : (new FeatureQuery(box, effectiveLimit, effectiveOffset, q, type, request.DistrictId, request.After), errors);
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
