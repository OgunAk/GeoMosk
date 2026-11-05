using System.Text.Json;
using GeoScope.Application.Features;
using GeoScope.Domain.Districts;
using GeoScope.Domain.Facilities;
using GeoScope.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using NetTopologySuite.Geometries;

namespace GeoScope.Infrastructure.Features;

internal sealed class SourceFeatureQueries(GeoScopeDbContext db) : ISourceFeatureQueries
{
    private const string OsmAttribution = "© OpenStreetMap katkıcıları, ODbL";
    private static readonly GeometryFactory Wgs84 = new(new PrecisionModel(), 4326);
    private static readonly string[] EditableFields = ["name", "description"];

    public async Task<IReadOnlyList<LayerInfo>> GetLayersAsync(CancellationToken cancellationToken)
    {
        var districts = await db.Districts.CountAsync(d => d.SourceDeletedAt == null, cancellationToken);
        var facilities = await db.HealthFacilities.CountAsync(f => f.SourceDeletedAt == null, cancellationToken);
        return
        [
            new(SourceLayerIds.Districts, "İlçe sınırları", "MultiPolygon", "osm", OsmAttribution, EditableFields, districts),
            new(SourceLayerIds.Facilities, "Sağlık tesisleri", "Point", "osm", OsmAttribution, EditableFields, facilities),
        ];
    }

    public async Task<GeoJsonFeatureCollection> GetDistrictsAsync(FeatureQuery query, CancellationToken cancellationToken)
    {
        var source = db.Districts.AsNoTracking().Where(d => d.SourceDeletedAt == null);
        if (query.Bbox is { } box)
        {
            var envelope = ToPolygon(box);
            source = source.Where(d => d.Geom.Intersects(envelope)); // ST_Intersects → GiST
        }
        if (query.Q is { } q)
        {
            var pattern = LikePattern(q);
            source = source.Where(d => EF.Functions.Like(
                SearchFunctions.Normalize(d.Override != null && d.Override.Name != null ? d.Override.Name : d.Name)!,
                "%" + SearchFunctions.Normalize(pattern) + "%", "\\"));
        }

        // Bir fazla satır alınır: hasMore'u ayrı COUNT sorgusu olmadan belirler.
        var rows = await source
            .OrderBy(d => d.Id)
            .Skip(query.Offset)
            .Take(query.Limit + 1)
            .Select(DistrictRow)
            .ToListAsync(cancellationToken);

        var features = rows.Take(query.Limit).Select(r => ToFeature(r, detail: false)).ToList();
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
        if (query.FacilityType is { } type)
            source = source.Where(f => f.FacilityType == type);
        if (query.DistrictId is { } districtId)
        {
            // Sınır dahil (ST_Covers): ilçe sınırı üzerindeki tesis o ilçede sayılır.
            source = source.Where(f => db.Districts.Any(d => d.Id == districtId && d.SourceDeletedAt == null && d.Geom.Covers(f.Geom)));
        }
        if (query.Q is { } q)
        {
            var pattern = LikePattern(q);
            source = source.Where(f => EF.Functions.Like(
                SearchFunctions.Normalize(f.Override != null && f.Override.Name != null ? f.Override.Name : f.Name)!,
                "%" + SearchFunctions.Normalize(pattern) + "%", "\\"));
        }

        var rows = await source
            .OrderBy(f => f.Id)
            .Skip(query.Offset)
            .Take(query.Limit + 1)
            .Select(FacilityRow)
            .ToListAsync(cancellationToken);

        var features = rows.Take(query.Limit).Select(r => ToFeature(r, detail: false, districtName: null)).ToList();
        return new GeoJsonFeatureCollection(features, Meta(features.Count, query, rows.Count > query.Limit));
    }

    public async Task<VersionedFeature?> GetDistrictAsync(long id, CancellationToken cancellationToken)
    {
        var row = await db.Districts.AsNoTracking()
            .Where(d => d.Id == id && d.SourceDeletedAt == null)
            .Select(DistrictRow)
            .SingleOrDefaultAsync(cancellationToken);
        return row is null ? null : new VersionedFeature(ToFeature(row, detail: true), row.Version ?? 0u);
    }

    public async Task<VersionedFeature?> GetFacilityAsync(long id, CancellationToken cancellationToken)
    {
        var row = await db.HealthFacilities.AsNoTracking()
            .Where(f => f.Id == id && f.SourceDeletedAt == null)
            .Select(FacilityRow)
            .SingleOrDefaultAsync(cancellationToken);
        if (row is null) return null;

        // Tesisin ilçesi A05 ile aynı tekil atama kuralıyla (ADR-0013): sınır dahil kapsayanlar içinden önce iç eşleşme, sonra en küçük id.
        var districtName = await db.Districts.AsNoTracking()
            .Where(d => d.SourceDeletedAt == null && d.Geom.Covers(row.Geom))
            .OrderByDescending(d => d.Geom.Contains(row.Geom))
            .ThenBy(d => d.Id)
            .Select(d => d.Override != null && d.Override.Name != null ? d.Override.Name : d.Name)
            .FirstOrDefaultAsync(cancellationToken);
        return new VersionedFeature(ToFeature(row, detail: true, districtName), row.Version ?? 0u);
    }

    // --- projeksiyonlar ---

    internal sealed record DistrictRowData(
        long Id, MultiPolygon Geom, string Name, string SourceName, string? Description, string SourceObjectType,
        long SourceId, string Attributes, DateTimeOffset? OverrideUpdatedAt, uint? Version);

    internal sealed record FacilityRowData(
        long Id, Point Geom, string? Name, string? SourceName, string? Description, string FacilityType, string SourceObjectType,
        long SourceId, string Attributes, DateTimeOffset? OverrideUpdatedAt, uint? Version);

    private static readonly System.Linq.Expressions.Expression<Func<District, DistrictRowData>> DistrictRow = d => new DistrictRowData(
        d.Id, d.Geom,
        d.Override != null && d.Override.Name != null ? d.Override.Name : d.Name,
        d.Name,
        d.Override != null ? d.Override.Description : null,
        d.SourceObjectType, d.SourceId, d.Attributes,
        d.Override != null ? d.Override.UpdatedAt : null,
        d.Override != null ? (uint?)d.Override.Version : null);

    internal static readonly System.Linq.Expressions.Expression<Func<HealthFacility, FacilityRowData>> FacilityRow = f => new FacilityRowData(
        f.Id, f.Geom,
        f.Override != null && f.Override.Name != null ? f.Override.Name : f.Name,
        f.Name,
        f.Override != null ? f.Override.Description : null,
        f.FacilityType, f.SourceObjectType, f.SourceId, f.Attributes,
        f.Override != null ? f.Override.UpdatedAt : null,
        f.Override != null ? (uint?)f.Override.Version : null);

    internal static GeoJsonFeature ToFeature(DistrictRowData r, bool detail)
    {
        var props = new Dictionary<string, object?>
        {
            ["layer"] = SourceLayerIds.Districts,
            ["name"] = r.Name,
            ["sourceName"] = r.SourceName,
            ["description"] = r.Description,
            ["osmType"] = r.SourceObjectType,
            ["osmId"] = r.SourceId,
        };
        if (detail) AddDetail(props, r.SourceObjectType, r.SourceId, r.Attributes, r.OverrideUpdatedAt);
        return new GeoJsonFeature(r.Id, r.Geom, props);
    }

    internal static GeoJsonFeature ToFeature(FacilityRowData r, bool detail, string? districtName)
    {
        var props = new Dictionary<string, object?>
        {
            ["layer"] = SourceLayerIds.Facilities,
            ["name"] = r.Name,
            ["sourceName"] = r.SourceName,
            ["description"] = r.Description,
            ["facilityType"] = r.FacilityType,
            ["osmType"] = r.SourceObjectType,
            ["osmId"] = r.SourceId,
            // Way/relation'dan üretilen nokta temsilîdir (ST_PointOnSurface); arayüz bunu belirtir.
            ["representativePoint"] = r.SourceObjectType != "node",
        };
        if (detail)
        {
            props["districtName"] = districtName;
            AddDetail(props, r.SourceObjectType, r.SourceId, r.Attributes, r.OverrideUpdatedAt);
        }
        return new GeoJsonFeature(r.Id, r.Geom, props);
    }

    private static void AddDetail(Dictionary<string, object?> props, string type, long id, string attributes, DateTimeOffset? overrideUpdatedAt)
    {
        using var doc = JsonDocument.Parse(attributes);
        props["tags"] = doc.RootElement.Clone();
        props["osmUrl"] = $"https://www.openstreetmap.org/{type}/{id}";
        props["localEditUpdatedAt"] = overrideUpdatedAt;
    }

    private static string LikePattern(string q) => SearchFunctions.EscapeLike(q);

    private static Polygon ToPolygon(BoundingBox b) =>
        (Polygon)Wgs84.ToGeometry(new Envelope(b.MinLon, b.MaxLon, b.MinLat, b.MaxLat));

    private static PageMeta Meta(int returned, FeatureQuery q, bool hasMore) => new(returned, q.Limit, q.Offset, hasMore);
}
