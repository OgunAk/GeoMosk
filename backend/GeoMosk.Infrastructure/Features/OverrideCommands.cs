using GeoMosk.Application.Features;
using GeoMosk.Domain.Districts;
using GeoMosk.Domain.Facilities;
using GeoMosk.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Npgsql;

namespace GeoMosk.Infrastructure.Features;

/// <summary>
/// Yerel ad/açıklama override'ları. Sürüm = override satırının xmin'i (yoksa 0). Override satırı silinmez:
/// silinip yeniden oluşturulsaydı sürüm 0'a dönerdi ve eski istemci yanlışlıkla eşleşebilirdi (ABA).
/// </summary>
internal sealed class OverrideCommands(GeoMoskDbContext db, ISourceFeatureQueries queries) : IOverrideCommands
{
    public async Task<OverrideUpdateResult> UpdateDistrictAsync(long id, OverridePatch patch, uint expectedVersion, CancellationToken cancellationToken)
    {
        var exists = await db.Districts.AnyAsync(d => d.Id == id && d.SourceDeletedAt == null, cancellationToken);
        if (!exists) return new(OverrideUpdateStatus.NotFound);

        var entity = await db.DistrictOverrides.SingleOrDefaultAsync(o => o.DistrictId == id, cancellationToken);
        if ((entity?.Version ?? 0u) != expectedVersion) return new(OverrideUpdateStatus.VersionMismatch);
        if (entity is null)
        {
            entity = new DistrictOverride { DistrictId = id };
            db.DistrictOverrides.Add(entity);
        }
        Apply(patch, v => entity.Name = v, v => entity.Description = v);
        entity.UpdatedAt = DateTimeOffset.UtcNow;

        if (!await TrySaveAsync(cancellationToken)) return new(OverrideUpdateStatus.VersionMismatch);
        return new(OverrideUpdateStatus.Updated, await queries.GetDistrictAsync(id, cancellationToken));
    }

    public async Task<OverrideUpdateResult> UpdateFacilityAsync(long id, OverridePatch patch, uint expectedVersion, CancellationToken cancellationToken)
    {
        var exists = await db.HealthFacilities.AnyAsync(f => f.Id == id && f.SourceDeletedAt == null, cancellationToken);
        if (!exists) return new(OverrideUpdateStatus.NotFound);

        var entity = await db.FacilityOverrides.SingleOrDefaultAsync(o => o.FacilityId == id, cancellationToken);
        if ((entity?.Version ?? 0u) != expectedVersion) return new(OverrideUpdateStatus.VersionMismatch);
        if (entity is null)
        {
            entity = new FacilityOverride { FacilityId = id };
            db.FacilityOverrides.Add(entity);
        }
        Apply(patch, v => entity.Name = v, v => entity.Description = v);
        entity.UpdatedAt = DateTimeOffset.UtcNow;

        if (!await TrySaveAsync(cancellationToken)) return new(OverrideUpdateStatus.VersionMismatch);
        return new(OverrideUpdateStatus.Updated, await queries.GetFacilityAsync(id, cancellationToken));
    }

    private static void Apply(OverridePatch patch, Action<string?> setName, Action<string?> setDescription)
    {
        if (patch.HasName) setName(patch.Name);
        if (patch.HasDescription) setDescription(patch.Description);
    }

    /// <summary>Eşzamanlı güncelleme (xmin değişti) veya eşzamanlı ilk oluşturma (PK çakışması) → false.</summary>
    private async Task<bool> TrySaveAsync(CancellationToken cancellationToken)
    {
        try
        {
            await db.SaveChangesAsync(cancellationToken);
            db.ChangeTracker.Clear();
            return true;
        }
        catch (DbUpdateConcurrencyException)
        {
            return false;
        }
        catch (DbUpdateException ex) when (ex.InnerException is PostgresException { SqlState: PostgresErrorCodes.UniqueViolation })
        {
            return false;
        }
    }
}
