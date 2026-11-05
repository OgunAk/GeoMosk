using GeoScope.Application.Features;

namespace GeoScope.Application.UserFeatures;

public enum UserFeatureWriteStatus
{
    Ok,
    NotFound,
    VersionMismatch,
    /// <summary>Geometri API doğrulamasını geçti ama veritabanı CHECK kısıtı (ST_IsValid vb.) reddetti → 422.</summary>
    GeometryRejected,
}

public sealed record UserFeatureWriteResult(UserFeatureWriteStatus Status, VersionedFeature? Feature = null);

/// <summary>Kullanıcı çizimleri katmanı (<c>user_features</c>). Kaynak tablolarından ayrıdır.</summary>
public interface IUserFeatureStore
{
    Task<GeoJsonFeatureCollection> ListAsync(FeatureQuery query, CancellationToken cancellationToken);
    Task<VersionedFeature?> GetAsync(Guid id, CancellationToken cancellationToken);
    Task<UserFeatureWriteResult> CreateAsync(UserFeatureCreate request, CancellationToken cancellationToken);
    Task<UserFeatureWriteResult> UpdateAsync(Guid id, UserFeaturePatch patch, uint expectedVersion, CancellationToken cancellationToken);
    Task<UserFeatureWriteStatus> DeleteAsync(Guid id, uint expectedVersion, CancellationToken cancellationToken);
}

public static class UserLayer
{
    public const string Id = "user-features";
}
