using GeoScope.Application.Features;
using GeoScope.Application.UserFeatures;
using GeoScope.Domain.UserFeatures;
using GeoScope.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using NetTopologySuite.Geometries;

namespace GeoScope.Infrastructure.Features;

/// <summary>Kullanıcı çizimleri. Sürüm = satırın xmin'i; güncelleme ve silme iyimser eşzamanlılıkla korunur.</summary>
internal sealed class UserFeatureStore(GeoScopeDbContext db) : IUserFeatureStore
{
    private static readonly GeometryFactory Wgs84 = new(new PrecisionModel(), 4326);

    public async Task<GeoJsonFeatureCollection> ListAsync(FeatureQuery query, CancellationToken cancellationToken)
    {
        var source = db.UserFeatures.AsNoTracking();
        if (query.Bbox is { } b)
        {
            var envelope = Wgs84.ToGeometry(new Envelope(b.MinLon, b.MaxLon, b.MinLat, b.MaxLat));
            source = source.Where(f => f.Geom.Intersects(envelope));
        }
        if (query.Q is { } q)
        {
            var pattern = SearchFunctions.EscapeLike(q);
            source = source.Where(f => EF.Functions.Like(SearchFunctions.Normalize(f.Name)!, "%" + SearchFunctions.Normalize(pattern) + "%", "\\"));
        }

        // Kullanıcı çizimlerinde sıralama oluşturma zamanı + id (UUID sırası anlamsız).
        var rows = await source
            .OrderBy(f => f.CreatedAt).ThenBy(f => f.Id)
            .Skip(query.Offset)
            .Take(query.Limit + 1)
            .ToListAsync(cancellationToken);

        var features = rows.Take(query.Limit).Select(ToFeature).ToList();
        return new GeoJsonFeatureCollection(features, new PageMeta(features.Count, query.Limit, query.Offset, rows.Count > query.Limit));
    }

    public async Task<VersionedFeature?> GetAsync(Guid id, CancellationToken cancellationToken)
    {
        var entity = await db.UserFeatures.AsNoTracking().SingleOrDefaultAsync(f => f.Id == id, cancellationToken);
        return entity is null ? null : new VersionedFeature(ToFeature(entity), entity.Version);
    }

    public async Task<VersionedFeature> CreateAsync(UserFeatureCreate request, CancellationToken cancellationToken)
    {
        var now = DateTimeOffset.UtcNow;
        var entity = new UserFeature
        {
            Id = Guid.NewGuid(),
            Name = request.Name,
            Description = request.Description,
            Geom = request.Geometry,
            CreatedAt = now,
            UpdatedAt = now,
        };
        db.UserFeatures.Add(entity);
        await db.SaveChangesAsync(cancellationToken); // xmin SaveChanges sonrası entity'ye okunur
        return new VersionedFeature(ToFeature(entity), entity.Version);
    }

    public async Task<UserFeatureWriteResult> UpdateAsync(Guid id, UserFeaturePatch patch, uint expectedVersion, CancellationToken cancellationToken)
    {
        var entity = await db.UserFeatures.SingleOrDefaultAsync(f => f.Id == id, cancellationToken);
        if (entity is null) return new(UserFeatureWriteStatus.NotFound);
        if (entity.Version != expectedVersion) return new(UserFeatureWriteStatus.VersionMismatch);

        // Öznitelik ve geometri aynı UPDATE ile yazılır (atomik).
        if (patch.Name is not null) entity.Name = patch.Name;
        if (patch.HasDescription) entity.Description = patch.Description;
        if (patch.Geometry is not null) entity.Geom = patch.Geometry;
        entity.UpdatedAt = DateTimeOffset.UtcNow;

        try
        {
            await db.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateConcurrencyException)
        {
            return new(UserFeatureWriteStatus.VersionMismatch);
        }
        return new(UserFeatureWriteStatus.Ok, new VersionedFeature(ToFeature(entity), entity.Version));
    }

    public async Task<UserFeatureWriteStatus> DeleteAsync(Guid id, uint expectedVersion, CancellationToken cancellationToken)
    {
        // Koşullu silme tek SQL: sürüm uyuşmazsa satır silinmez.
        var deleted = await db.UserFeatures
            .Where(f => f.Id == id && f.Version == expectedVersion)
            .ExecuteDeleteAsync(cancellationToken);
        if (deleted == 1) return UserFeatureWriteStatus.Ok;
        var exists = await db.UserFeatures.AnyAsync(f => f.Id == id, cancellationToken);
        return exists ? UserFeatureWriteStatus.VersionMismatch : UserFeatureWriteStatus.NotFound;
    }

    private static GeoJsonFeature ToFeature(UserFeature f) => new(f.Id, f.Geom, new Dictionary<string, object?>
    {
        ["layer"] = UserLayer.Id,
        ["name"] = f.Name,
        ["description"] = f.Description,
        ["geometryType"] = f.Geom.GeometryType,
        ["createdAt"] = f.CreatedAt,
        ["updatedAt"] = f.UpdatedAt,
    });
}
