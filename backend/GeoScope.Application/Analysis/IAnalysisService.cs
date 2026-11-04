using GeoScope.Application.Features;

namespace GeoScope.Application.Analysis;

/// <summary>
/// Analiz yanıtı: <see cref="Input"/> haritada gösterilecek girdi (alan, tampon poligonu veya tıklanan nokta),
/// <see cref="Matches"/> bulunan tesisler (GeoJSON FeatureCollection), <see cref="Parameters"/> yöntem/birim bilgisi.
/// </summary>
public sealed record AnalysisResponse(
    string Analysis,
    GeoJsonFeature Input,
    GeoJsonFeatureCollection Matches,
    IReadOnlyDictionary<string, object?> Parameters);

public enum AnalysisStatus
{
    Ok,
    SourceNotFound,
    /// <summary>Kaynak obje bu analiz için uygun değil (ör. alan analizinde nokta).</summary>
    SourceNotApplicable,
}

public sealed record AnalysisResult(AnalysisStatus Status, AnalysisResponse? Response = null, string? Problem = null);

public interface IAnalysisService
{
    Task<AnalysisResult> WithinAsync(WithinRequest request, CancellationToken cancellationToken);
    Task<AnalysisResult> BufferAsync(BufferRequest request, CancellationToken cancellationToken);
    Task<AnalysisResult> NearestAsync(NearestRequest request, CancellationToken cancellationToken);
}
