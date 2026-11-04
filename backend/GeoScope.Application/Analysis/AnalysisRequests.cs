using System.Globalization;
using System.Text.Json;
using GeoScope.Application.UserFeatures;
using GeoScope.Domain.Facilities;
using NetTopologySuite.Geometries;

namespace GeoScope.Application.Analysis;

/// <summary>Analiz girdisi olarak mevcut bir kayıt. Geometri her zaman sunucudan okunur (istemci kopyasına güvenilmez).</summary>
public sealed record SourceRef(string LayerId, string Id);

/// <summary>Girdi: ya kayıtlı bir obje ya da doğrudan geometri (tam olarak biri).</summary>
public sealed record AnalysisInput(SourceRef? Source, Geometry? Geometry);

/// <summary>A01: alan içindeki tesisler. Sınır dahil (varsayılan) ST_Covers, hariç ST_Within.</summary>
public sealed record WithinRequest(AnalysisInput Area, bool IncludeBoundary, int Limit);

/// <summary>A02: tampon. Seçim ST_DWithin(geography) ile metre cinsinden; çizilen tampon yaklaşık görseldir.</summary>
public sealed record BufferRequest(AnalysisInput Source, double RadiusMeters, bool ExcludeSource, int Limit);

/// <summary>A03: en yakın N. Kesin sıralama ST_Distance(geography) + id.</summary>
public sealed record NearestRequest(Point Point, int N, string? FacilityType, double? MaxDistanceMeters);

/// <summary>A04: metrik ölçüm. Çizgi → uzunluk; alan → alan + çevre. Nokta desteklenmez (422, 0 dönülmez).</summary>
public sealed record MeasureRequest(AnalysisInput Input);

/// <summary>
/// A04 ölçüm projeksiyonu: EPSG:32635 (WGS 84 / UTM 35N). Kullanım alanı 24°D–30°D, 0°K–84°K.
/// Bursa verisinin kapsamı 28.09°D–29.91°D (2026-11-05 sorgusu) zonun içindedir; seçim gerekçesi ADR-0013.
/// </summary>
public static class MetricProjection
{
    public const int Srid = 32635;
    public const string Name = "WGS 84 / UTM zone 35N";
    public const double MinLon = 24, MaxLon = 30, MinLat = 0, MaxLat = 84;

    public static bool Covers(Geometry geometry)
    {
        var e = geometry.EnvelopeInternal;
        return e.MinX >= MinLon && e.MaxX <= MaxLon && e.MinY >= MinLat && e.MaxY <= MaxLat;
    }
}

public static class AnalysisLimits
{
    public const int DefaultLimit = 500;
    public const int MaxLimit = 2000;
    public const double MaxRadiusMeters = 50_000;
    public const int MaxN = 100;
}

public static class AnalysisLayers
{
    public const string Districts = "districts";
    public const string Facilities = "facilities";
    public const string UserFeatures = "user-features";
    public static readonly string[] All = [Districts, Facilities, UserFeatures];
}

/// <summary>Analiz istek gövdeleri. Biçim hataları 400, geometri/anlam hataları 422 (UserFeatures ile aynı politika).</summary>
public static class AnalysisRequestParser
{
    public static (WithinRequest? Value, RequestErrors Errors) ParseWithin(JsonElement body)
    {
        var errors = new Dictionary<string, string[]>();
        if (!RequireObject(body, ["sourceFeature", "geometry", "includeBoundary", "limit"], errors)) return Fail<WithinRequest>(errors);
        var (input, unprocessable) = ReadInput(body, errors);
        var includeBoundary = ReadBool(body, "includeBoundary", true, errors);
        var limit = ReadInt(body, "limit", AnalysisLimits.DefaultLimit, 1, AnalysisLimits.MaxLimit, errors);
        if (input?.Geometry is { } g && g is not (Polygon or MultiPolygon))
        {
            errors["geometry"] = ["Alan analizi için geometry Polygon olmalı."];
            unprocessable = true;
        }
        if (input?.Source is { LayerId: AnalysisLayers.Facilities })
        {
            errors["sourceFeature.layerId"] = ["Alan analizi için kaynak bir ilçe veya alan (Polygon) kullanıcı çizimi olmalı."];
            unprocessable = true;
        }
        return Result(errors, unprocessable, () => new WithinRequest(input!, includeBoundary, limit));
    }

    public static (BufferRequest? Value, RequestErrors Errors) ParseBuffer(JsonElement body)
    {
        var errors = new Dictionary<string, string[]>();
        if (!RequireObject(body, ["sourceFeature", "geometry", "radiusMeters", "excludeSource", "limit"], errors)) return Fail<BufferRequest>(errors);
        var (input, unprocessable) = ReadInput(body, errors);
        var radius = ReadDouble(body, "radiusMeters", required: true, errors);
        if (radius is { } r && (r <= 0 || r > AnalysisLimits.MaxRadiusMeters))
            errors["radiusMeters"] = [$"radiusMeters 0'dan büyük ve en çok {AnalysisLimits.MaxRadiusMeters:0} metre olmalı."];
        var exclude = ReadBool(body, "excludeSource", true, errors);
        var limit = ReadInt(body, "limit", AnalysisLimits.DefaultLimit, 1, AnalysisLimits.MaxLimit, errors);
        return Result(errors, unprocessable, () => new BufferRequest(input!, radius!.Value, exclude, limit));
    }

    public static (MeasureRequest? Value, RequestErrors Errors) ParseMeasure(JsonElement body)
    {
        var errors = new Dictionary<string, string[]>();
        if (!RequireObject(body, ["sourceFeature", "geometry"], errors)) return Fail<MeasureRequest>(errors);
        var (input, unprocessable) = ReadInput(body, errors);
        if (input?.Geometry is Point)
        {
            errors["geometry"] = ["Desteklenmeyen ölçüm: noktanın uzunluğu veya alanı yoktur. Çizgi ya da alan seçin."];
            unprocessable = true;
        }
        if (input?.Source is { LayerId: AnalysisLayers.Facilities })
        {
            errors["sourceFeature.layerId"] = ["Desteklenmeyen ölçüm: sağlık tesisleri noktadır. İlçe veya çizgi/alan çizimi seçin."];
            unprocessable = true;
        }
        return Result(errors, unprocessable, () => new MeasureRequest(input!));
    }

    public static (NearestRequest? Value, RequestErrors Errors) ParseNearest(JsonElement body)
    {
        var errors = new Dictionary<string, string[]>();
        if (!RequireObject(body, ["point", "n", "type", "maxDistanceMeters"], errors)) return Fail<NearestRequest>(errors);

        Point? point = null;
        var unprocessable = false;
        if (!body.TryGetProperty("point", out var pointElement) || pointElement.ValueKind == JsonValueKind.Null)
        {
            errors["point"] = ["point (GeoJSON Point) zorunlu."];
        }
        else
        {
            var parsed = UserGeometryParser.Parse(pointElement);
            if (parsed.Error is not null)
            {
                errors["point"] = [parsed.Error];
                unprocessable = !parsed.Malformed;
            }
            else if (parsed.Geometry is not Point p)
            {
                errors["point"] = ["point bir GeoJSON Point olmalı."];
                unprocessable = true;
            }
            else point = p;
        }

        var n = ReadInt(body, "n", 5, 1, AnalysisLimits.MaxN, errors);
        string? type = null;
        if (body.TryGetProperty("type", out var typeElement) && typeElement.ValueKind != JsonValueKind.Null)
        {
            type = typeElement.ValueKind == JsonValueKind.String ? typeElement.GetString() : null;
            if (type is null || !FacilityTypes.All.Contains(type))
                errors["type"] = [$"Geçersiz tesis türü. İzin verilenler: {string.Join(", ", FacilityTypes.All)}."];
        }
        var max = ReadDouble(body, "maxDistanceMeters", required: false, errors);
        if (max is { } m && (m <= 0 || m > AnalysisLimits.MaxRadiusMeters))
            errors["maxDistanceMeters"] = [$"maxDistanceMeters 0'dan büyük ve en çok {AnalysisLimits.MaxRadiusMeters:0} metre olmalı."];

        return Result(errors, unprocessable, () => new NearestRequest(point!, n, type, max));
    }

    // --- yardımcılar ---

    private static bool RequireObject(JsonElement body, string[] allowed, Dictionary<string, string[]> errors)
    {
        if (body.ValueKind != JsonValueKind.Object)
        {
            errors[""] = ["Gövde bir JSON nesnesi olmalı."];
            return false;
        }
        foreach (var p in body.EnumerateObject())
        {
            if (!allowed.Contains(p.Name))
                errors[p.Name] = [$"Bu alan kabul edilmez. İzin verilenler: {string.Join(", ", allowed)}."];
        }
        return true;
    }

    private static (AnalysisInput? Input, bool Unprocessable) ReadInput(JsonElement body, Dictionary<string, string[]> errors)
    {
        var hasSource = body.TryGetProperty("sourceFeature", out var source) && source.ValueKind != JsonValueKind.Null;
        var hasGeometry = body.TryGetProperty("geometry", out var geometry) && geometry.ValueKind != JsonValueKind.Null;
        if (hasSource == hasGeometry)
        {
            errors["sourceFeature"] = ["sourceFeature veya geometry alanlarından tam olarak biri gönderilmeli."];
            return (null, false);
        }

        if (hasGeometry)
        {
            var parsed = UserGeometryParser.Parse(geometry);
            if (parsed.Error is not null)
            {
                errors["geometry"] = [parsed.Error];
                return (null, !parsed.Malformed);
            }
            return (new AnalysisInput(null, parsed.Geometry), false);
        }

        if (source.ValueKind != JsonValueKind.Object
            || !source.TryGetProperty("layerId", out var layer) || layer.ValueKind != JsonValueKind.String
            || !source.TryGetProperty("id", out var id) || id.ValueKind is not (JsonValueKind.String or JsonValueKind.Number))
        {
            errors["sourceFeature"] = ["sourceFeature { layerId: metin, id: metin veya sayı } olmalı."];
            return (null, false);
        }
        var layerId = layer.GetString()!;
        if (!AnalysisLayers.All.Contains(layerId))
        {
            errors["sourceFeature.layerId"] = [$"layerId şunlardan biri olmalı: {string.Join(", ", AnalysisLayers.All)}."];
            return (null, false);
        }
        var idText = id.ValueKind == JsonValueKind.Number ? id.GetRawText() : id.GetString()!;
        var validId = layerId == AnalysisLayers.UserFeatures
            ? Guid.TryParse(idText, out _)
            : long.TryParse(idText, NumberStyles.None, CultureInfo.InvariantCulture, out var n) && n > 0;
        if (!validId)
        {
            errors["sourceFeature.id"] = ["id katmanın kimlik biçimine uymuyor (kaynak katmanlarda pozitif sayı, kullanıcı çizimlerinde UUID)."];
            return (null, false);
        }
        return (new AnalysisInput(new SourceRef(layerId, idText), null), false);
    }

    private static bool ReadBool(JsonElement body, string name, bool fallback, Dictionary<string, string[]> errors)
    {
        if (!body.TryGetProperty(name, out var v) || v.ValueKind == JsonValueKind.Null) return fallback;
        if (v.ValueKind is JsonValueKind.True or JsonValueKind.False) return v.GetBoolean();
        errors[name] = [$"{name} true/false olmalı."];
        return fallback;
    }

    private static int ReadInt(JsonElement body, string name, int fallback, int min, int max, Dictionary<string, string[]> errors)
    {
        if (!body.TryGetProperty(name, out var v) || v.ValueKind == JsonValueKind.Null) return fallback;
        if (v.ValueKind == JsonValueKind.Number && v.TryGetInt32(out var i) && i >= min && i <= max) return i;
        errors[name] = [$"{name} {min} ile {max} arasında tam sayı olmalı."];
        return fallback;
    }

    private static double? ReadDouble(JsonElement body, string name, bool required, Dictionary<string, string[]> errors)
    {
        if (!body.TryGetProperty(name, out var v) || v.ValueKind == JsonValueKind.Null)
        {
            if (required) errors[name] = [$"{name} zorunlu."];
            return null;
        }
        if (v.ValueKind == JsonValueKind.Number && v.TryGetDouble(out var d) && double.IsFinite(d)) return d;
        errors[name] = [$"{name} sonlu bir sayı olmalı."];
        return null;
    }

    private static (T? Value, RequestErrors Errors) Fail<T>(Dictionary<string, string[]> errors) where T : class =>
        (null, new RequestErrors(errors, false));

    private static (T? Value, RequestErrors Errors) Result<T>(Dictionary<string, string[]> errors, bool unprocessable, Func<T> create) where T : class
    {
        if (errors.Count == 0) return (create(), RequestErrors.Empty);
        // Yalnız geometri/anlam hatası varsa 422; biçim hatası varsa 400 öncelikli.
        return (null, new RequestErrors(errors, unprocessable && errors.Keys.All(k => k is "geometry" or "point" or "sourceFeature.layerId")));
    }
}
