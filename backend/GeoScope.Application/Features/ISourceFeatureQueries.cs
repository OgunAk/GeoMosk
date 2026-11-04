namespace GeoScope.Application.Features;

/// <summary>İçe aktarılan kaynak katmanlarının (ilçe, tesis) okuma portu. Kaynakta silinmiş kayıtlar dönmez.</summary>
public interface ISourceFeatureQueries
{
    Task<GeoJsonFeatureCollection> GetDistrictsAsync(FeatureQuery query, CancellationToken cancellationToken);
    Task<GeoJsonFeatureCollection> GetFacilitiesAsync(FeatureQuery query, CancellationToken cancellationToken);
}
