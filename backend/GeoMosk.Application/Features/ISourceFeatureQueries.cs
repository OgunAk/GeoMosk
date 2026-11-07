namespace GeoMosk.Application.Features;

/// <summary>İçe aktarılan kaynak katmanlarının (ilçe, tesis) okuma portu. Kaynakta silinmiş kayıtlar dönmez.</summary>
public interface ISourceFeatureQueries
{
    Task<IReadOnlyList<LayerInfo>> GetLayersAsync(CancellationToken cancellationToken);
    Task<GeoJsonFeatureCollection> GetDistrictsAsync(FeatureQuery query, CancellationToken cancellationToken);
    Task<GeoJsonFeatureCollection> GetFacilitiesAsync(FeatureQuery query, CancellationToken cancellationToken);
    Task<VersionedFeature?> GetDistrictAsync(long id, CancellationToken cancellationToken);
    Task<VersionedFeature?> GetFacilityAsync(long id, CancellationToken cancellationToken);
}

/// <summary>Tekil Feature + iyimser eşzamanlılık sürümü (HTTP ETag). Override yoksa sürüm 0.</summary>
public sealed record VersionedFeature(GeoJsonFeature Feature, uint Version);

public sealed record LayerInfo(
    string Id,
    string Title,
    string GeometryType,
    string Source,
    string Attribution,
    IReadOnlyList<string> EditableFields,
    int FeatureCount);

public static class SourceLayerIds
{
    public const string Districts = "districts";
    public const string Facilities = "facilities";
}
