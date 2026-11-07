using System.Text.Json;
using NetTopologySuite.Geometries;
using NetTopologySuite.Operation.Valid;

namespace GeoMosk.Application.UserFeatures;

/// <summary>
/// Kullanıcı çizimi geometrisinin sunucu tarafı doğrulaması (istemci doğrulamasına güvenilmez).
/// Biçim hataları (eksik/yanlış JSON tipi) 400, geometri anlamı hataları 422 olarak ayrılır.
/// Hatalı şekil sessizce onarılmaz veya dönüştürülmez (Multi*/GeometryCollection kabul edilmez).
/// </summary>
public static class UserGeometryParser
{
    public const int MaxVertices = 10_000;

    /// <summary>Bursa çalışma alanı (import kalite kontrolüyle aynı zarf). Dışı çoğunlukla ters koordinat sırasıdır.</summary>
    public static readonly Envelope StudyArea = new(28.0, 30.1, 39.5, 40.8);

    private static readonly GeometryFactory Wgs84 = new(new PrecisionModel(), 4326);
    private static readonly string[] SupportedTypes = ["Point", "LineString", "Polygon"];

    public sealed record Result(Geometry? Geometry, bool Malformed, string? Error);

    public static Result Parse(JsonElement element)
    {
        if (element.ValueKind != JsonValueKind.Object)
            return Bad("geometry bir GeoJSON geometri nesnesi olmalı.");
        if (!element.TryGetProperty("type", out var typeElement) || typeElement.ValueKind != JsonValueKind.String)
            return Bad("geometry.type metin olmalı.");
        if (element.TryGetProperty("crs", out _))
            return Invalid("crs üyesi desteklenmez (RFC 7946); koordinatlar EPSG:4326 [boylam, enlem] olmalı.");

        var type = typeElement.GetString()!;
        if (!SupportedTypes.Contains(type))
            return Invalid($"Desteklenmeyen geometri tipi '{type}'. Yalnızca Point, LineString ve Polygon kabul edilir.");
        if (!element.TryGetProperty("coordinates", out var coords) || coords.ValueKind != JsonValueKind.Array)
            return Bad("geometry.coordinates dizi olmalı.");

        var vertexCount = 0;
        try
        {
            Geometry geometry = type switch
            {
                "Point" => Wgs84.CreatePoint(ReadPosition(coords, ref vertexCount)),
                "LineString" => ReadLineString(coords, ref vertexCount),
                _ => ReadPolygon(coords, ref vertexCount),
            };

            if (!StudyArea.Contains(geometry.EnvelopeInternal))
                return Invalid("Geometri Bursa çalışma alanı dışında. Koordinat sırası [boylam, enlem] olmalı (ör. [29.06, 40.19]).");

            var validity = new IsValidOp(geometry).ValidationError;
            if (validity is not null)
                return Invalid($"Geçersiz geometri: {Translate(validity.ErrorType)} ({validity.Coordinate?.X:0.######}, {validity.Coordinate?.Y:0.######}).");

            return new Result(geometry, false, null);
        }
        catch (GeometryFormatException ex)
        {
            return ex.Malformed ? Bad(ex.Message) : Invalid(ex.Message);
        }
    }

    private static Coordinate ReadPosition(JsonElement position, ref int vertexCount)
    {
        if (position.ValueKind != JsonValueKind.Array)
            throw new GeometryFormatException("Her konum [boylam, enlem] dizisi olmalı.", malformed: true);
        var length = position.GetArrayLength();
        if (length != 2)
            throw new GeometryFormatException("Konumlar yalnızca 2 boyutlu olmalı: [boylam, enlem].", malformed: length < 2);
        if (position[0].ValueKind != JsonValueKind.Number || position[1].ValueKind != JsonValueKind.Number)
            throw new GeometryFormatException("Koordinatlar sayı olmalı.", malformed: true);

        var lon = position[0].GetDouble();
        var lat = position[1].GetDouble();
        if (!double.IsFinite(lon) || !double.IsFinite(lat))
            throw new GeometryFormatException("Koordinatlar sonlu sayı olmalı.", malformed: false);
        if (lon is < -180 or > 180 || lat is < -90 or > 90)
            throw new GeometryFormatException("Boylam [-180,180], enlem [-90,90] aralığında olmalı.", malformed: false);

        if (++vertexCount > MaxVertices)
            throw new GeometryFormatException($"Geometri en çok {MaxVertices} köşe içerebilir.", malformed: false);
        return new Coordinate(lon, lat);
    }

    private static Coordinate[] ReadPositions(JsonElement array, ref int vertexCount)
    {
        if (array.ValueKind != JsonValueKind.Array)
            throw new GeometryFormatException("Konum listesi dizi olmalı.", malformed: true);
        var result = new Coordinate[array.GetArrayLength()];
        var i = 0;
        foreach (var position in array.EnumerateArray())
            result[i++] = ReadPosition(position, ref vertexCount);
        return result;
    }

    private static LineString ReadLineString(JsonElement coords, ref int vertexCount)
    {
        var positions = ReadPositions(coords, ref vertexCount);
        if (positions.Length < 2)
            throw new GeometryFormatException("LineString en az 2 konum içermeli.", malformed: false);
        return Wgs84.CreateLineString(positions);
    }

    private static Polygon ReadPolygon(JsonElement coords, ref int vertexCount)
    {
        if (coords.GetArrayLength() == 0)
            throw new GeometryFormatException("Polygon en az bir halka içermeli.", malformed: false);
        var rings = new List<LinearRing>();
        foreach (var ringElement in coords.EnumerateArray())
        {
            var positions = ReadPositions(ringElement, ref vertexCount);
            if (positions.Length < 4)
                throw new GeometryFormatException("Polygon halkası en az 4 konum içermeli (ilk ve son aynı).", malformed: false);
            if (!positions[0].Equals2D(positions[^1]))
                throw new GeometryFormatException("Polygon halkası kapalı olmalı: ilk ve son konum aynı olmalı.", malformed: false);
            rings.Add(Wgs84.CreateLinearRing(positions));
        }
        return Wgs84.CreatePolygon(rings[0], rings.Skip(1).ToArray());
    }

    private static string Translate(TopologyValidationErrors error) => error switch
    {
        TopologyValidationErrors.SelfIntersection or TopologyValidationErrors.RingSelfIntersection => "kendini kesiyor",
        TopologyValidationErrors.TooFewPoints => "yeterli farklı nokta yok",
        TopologyValidationErrors.HoleOutsideShell => "delik dış halkanın dışında",
        TopologyValidationErrors.NestedHoles => "iç içe delikler",
        TopologyValidationErrors.DisconnectedInteriors => "iç bölge bağlantısız",
        TopologyValidationErrors.RingNotClosed => "halka kapalı değil",
        _ => error.ToString(),
    };

    private static Result Bad(string error) => new(null, true, error);
    private static Result Invalid(string error) => new(null, false, error);

    private sealed class GeometryFormatException(string message, bool malformed) : Exception(message)
    {
        public bool Malformed { get; } = malformed;
    }
}
