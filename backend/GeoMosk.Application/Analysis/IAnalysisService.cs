using GeoMosk.Application.Features;

namespace GeoMosk.Application.Analysis;

/// <summary>
/// Analiz yanıtı: <see cref="Input"/> haritada gösterilecek girdi (alan, tampon poligonu veya tıklanan nokta),
/// <see cref="Matches"/> bulunan tesisler (GeoJSON FeatureCollection), <see cref="Parameters"/> yöntem/birim bilgisi.
/// </summary>
public sealed record AnalysisResponse(
    string Analysis,
    GeoJsonFeature Input,
    GeoJsonFeatureCollection Matches,
    IReadOnlyDictionary<string, object?> Parameters,
    MeasurementResult? Measurement = null);

/// <summary>
/// A04 sonucu. Ham değerler metre/m² (yuvarlanmamış); <see cref="CalculationSrid"/> projeksiyonunda ST_Transform sonrası hesaplanır.
/// <see cref="GeodesicCheck"/> yalnız çapraz kontroldür (geography, WGS84 sferoidi); asıl değer projeksiyondaki ölçümdür.
/// </summary>
public sealed record MeasurementResult(
    string GeometryType,
    double? LengthMeters,
    double? AreaSquareMeters,
    double? PerimeterMeters,
    int CalculationSrid,
    string CalculationCrs,
    string Method,
    GeodesicCheck GeodesicCheck);

/// <summary>Aynı geometrinin sferoid üzerindeki (geography) değeri ve projeksiyon ölçümüyle göreli farkı.</summary>
public sealed record GeodesicCheck(double? LengthMeters, double? AreaSquareMeters, double RelativeDifference);

public enum AnalysisStatus
{
    Ok,
    SourceNotFound,
    /// <summary>Kaynak obje bu analiz için uygun değil (ör. alan analizinde nokta).</summary>
    SourceNotApplicable,
}

/// <param name="ProblemField">422 için hata alanı (varsayılan <c>sourceFeature</c>).</param>
public sealed record AnalysisResult(AnalysisStatus Status, AnalysisResponse? Response = null, string? Problem = null, string ProblemField = "sourceFeature");

public interface IAnalysisService
{
    Task<AnalysisResult> WithinAsync(WithinRequest request, CancellationToken cancellationToken);
    Task<AnalysisResult> BufferAsync(BufferRequest request, CancellationToken cancellationToken);
    Task<AnalysisResult> NearestAsync(NearestRequest request, CancellationToken cancellationToken);
    Task<AnalysisResult> MeasureAsync(MeasureRequest request, CancellationToken cancellationToken);
    Task<DistrictStatsResponse> DistrictStatsAsync(string? facilityType, CancellationToken cancellationToken);
}
