namespace GeoScope.Application.Features;

public enum OverrideUpdateStatus
{
    Updated,
    NotFound,
    VersionMismatch,
}

public sealed record OverrideUpdateResult(OverrideUpdateStatus Status, VersionedFeature? Feature = null);

/// <summary>Kaynak kayıtların yerel override yazma portu. Kaynak tablolarına yazmaz.</summary>
public interface IOverrideCommands
{
    Task<OverrideUpdateResult> UpdateDistrictAsync(long id, OverridePatch patch, uint expectedVersion, CancellationToken cancellationToken);
    Task<OverrideUpdateResult> UpdateFacilityAsync(long id, OverridePatch patch, uint expectedVersion, CancellationToken cancellationToken);
}
