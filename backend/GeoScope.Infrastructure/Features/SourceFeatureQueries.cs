using GeoScope.Application.Features;
using GeoScope.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using NetTopologySuite.Geometries;

namespace GeoScope.Infrastructure.Features;

internal sealed class SourceFeatureQueries(GeoScopeDbContext db) : ISourceFeatureQueries
{
    private static readonly GeometryFactory Wgs84 = new(new PrecisionModel(), 4326);

    public async Task<GeoJsonFeatureCollection> GetDistrictsAsync(FeatureQuery query, CancellationToken cancellationToken)
    {
        var source = db.Districts.AsNoTracking().Where(d => d.SourceDeletedAt == null);
        if (query.Bbox is { } box)
        {
            var envelope = ToPolygon(box);
            source = source.Where(d => d.Geom.Intersects(envelope)); // ST_Intersects → GiST
        }

        // Bir fazla satır alınır: hasMore'u ayrı COUNT sorgusu olmadan belirler.
        var rows = await source
            .OrderBy(d => d.Id)
            .Skip(query.Offset)
            .Take(query.Limit + 1)
            .Select(d => new
            {
                d.Id,
                d.Geom,
                Name = d.Override != null && d.Override.Name != null ? d.Override.Name : d.Name,
                SourceName = d.Name,
                Description = d.Override != null ? d.Override.Description : null,
                d.SourceObjectType,
                d.SourceId,
            })
            .ToListAsync(cancellationToken);

        var features = rows.Take(query.Limit).Select(r => new GeoJsonFeature(r.Id, r.Geom, new Dictionary<string, object?>
        {
            ["layer"] = "districts",
            ["name"] = r.Name,
            ["sourceName"] = r.SourceName,
            ["description"] = r.Description,
            ["osmType"] = r.SourceObjectType,
            ["osmId"] = r.SourceId,
        })).ToList();
        return new GeoJsonFeatureCollection(features, Meta(features.Count, query, rows.Count > query.Limit));
    }

    public async Task<GeoJsonFeatureCollection> GetFacilitiesAsync(FeatureQuery query, CancellationToken cancellationToken)
    {
        var source = db.HealthFacilities.AsNoTracking().Where(f => f.SourceDeletedAt == null);
        if (query.Bbox is { } box)
        {
            var envelope = ToPolygon(box);
            source = source.Where(f => f.Geom.Intersects(envelope));
        }

        var rows = await source
            .OrderBy(f => f.Id)
            .Skip(query.Offset)
            .Take(query.Limit + 1)
            .Select(f => new
            {
                f.Id,
                f.Geom,
                Name = f.Override != null && f.Override.Name != null ? f.Override.Name : f.Name,
                SourceName = f.Name,
                Description = f.Override != null ? f.Override.Description : null,
                f.FacilityType,
                f.SourceObjectType,
                f.SourceId,
            })
            .ToListAsync(cancellationToken);

        var features = rows.Take(query.Limit).Select(r => new GeoJsonFeature(r.Id, r.Geom, new Dictionary<string, object?>
        {
            ["layer"] = "facilities",
            ["name"] = r.Name,
            ["sourceName"] = r.SourceName,
            ["description"] = r.Description,
            ["facilityType"] = r.FacilityType,
            ["osmType"] = r.SourceObjectType,
            ["osmId"] = r.SourceId,
            // Way/relation'dan üretilen nokta temsilîdir (ST_PointOnSurface); arayüz bunu belirtebilir.
            ["representativePoint"] = r.SourceObjectType != "node",
        })).ToList();
        return new GeoJsonFeatureCollection(features, Meta(features.Count, query, rows.Count > query.Limit));
    }

    private static Polygon ToPolygon(BoundingBox b) =>
        (Polygon)Wgs84.ToGeometry(new Envelope(b.MinLon, b.MaxLon, b.MinLat, b.MaxLat));

    private static PageMeta Meta(int returned, FeatureQuery q, bool hasMore) => new(returned, q.Limit, q.Offset, hasMore);
}
