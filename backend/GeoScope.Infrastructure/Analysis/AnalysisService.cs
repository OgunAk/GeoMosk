using System.Data.Common;
using GeoScope.Application.Analysis;
using GeoScope.Application.Features;
using GeoScope.Infrastructure.Features;
using GeoScope.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using NetTopologySuite.Geometries;
using Npgsql;
using NpgsqlTypes;

namespace GeoScope.Infrastructure.Analysis;

/// <summary>
/// A01-A03 PostGIS analizleri. Metre cinsinden her ölçüm geography (WGS84 sferoidi) üzerindedir;
/// 4326 geometry üzerinde derece ile mesafe hesaplanmaz. Parametreler her zaman bağlanır (string birleştirme yok).
/// </summary>
internal sealed class AnalysisService(GeoScopeDbContext db) : IAnalysisService
{
    // Görsel tampon için çeyrek daire başına segment: 16 → 64 kenarlı yaklaşık çember. Seçim bundan bağımsızdır (ST_DWithin).
    private const string BufferStyle = "quad_segs=16";

    public async Task<AnalysisResult> WithinAsync(WithinRequest request, CancellationToken cancellationToken)
    {
        var (status, area, _, label) = await ResolveAsync(request.Area, cancellationToken);
        if (status != AnalysisStatus.Ok) return new(status, Problem: label);
        if (area is not (Polygon or MultiPolygon))
            return new(AnalysisStatus.SourceNotApplicable, Problem: "Alan analizi için kaynak bir alan (Polygon/MultiPolygon) olmalı.");

        var facilities = db.HealthFacilities.AsNoTracking().Where(f => f.SourceDeletedAt == null);
        // Sınır dahil: ST_Covers(alan, nokta). Hariç: ST_Within(nokta, alan). İkisi de geometry GiST indeksini kullanır.
        facilities = request.IncludeBoundary
            ? facilities.Where(f => area!.Covers(f.Geom))
            : facilities.Where(f => f.Geom.Within(area!));

        var rows = await facilities.OrderBy(f => f.Id).Take(request.Limit + 1)
            .Select(SourceFeatureQueries.FacilityRow).ToListAsync(cancellationToken);
        var features = rows.Take(request.Limit).Select(r => SourceFeatureQueries.ToFeature(r, detail: false, districtName: null)).ToList();

        return Ok("within", InputFeature(area!, "area", request.Area, label),
            new GeoJsonFeatureCollection(features, new PageMeta(features.Count, request.Limit, 0, rows.Count > request.Limit)),
            new Dictionary<string, object?>
            {
                ["includeBoundary"] = request.IncludeBoundary,
                ["predicate"] = request.IncludeBoundary ? "ST_Covers(alan, tesis)" : "ST_Within(tesis, alan)",
            });
    }

    public async Task<AnalysisResult> BufferAsync(BufferRequest request, CancellationToken cancellationToken)
    {
        var (status, source, sourceFacilityId, label) = await ResolveAsync(request.Source, cancellationToken);
        if (status != AnalysisStatus.Ok) return new(status, Problem: label);

        var excludeId = request.ExcludeSource ? sourceFacilityId ?? -1 : -1;
        const string sql = """
            SELECT f.id, ST_Distance(f.geom::geography, @src::geography) AS distance_meters
            FROM health_facilities f
            WHERE f.source_deleted_at IS NULL
              AND ST_DWithin(f.geom::geography, @src::geography, @radius)
              AND f.id <> @exclude
            ORDER BY distance_meters, f.id
            LIMIT @take
            """;
        var distances = await QueryDistancesAsync(sql, cancellationToken,
            Geo("src", source!), new NpgsqlParameter("radius", NpgsqlDbType.Double) { Value = request.RadiusMeters },
            new NpgsqlParameter("exclude", NpgsqlDbType.Bigint) { Value = excludeId },
            new NpgsqlParameter("take", NpgsqlDbType.Integer) { Value = request.Limit + 1 });

        var bufferPolygon = await ScalarGeometryAsync(
            "SELECT ST_Buffer(@src::geography, @radius, @style)::geometry", cancellationToken,
            Geo("src", source!), new NpgsqlParameter("radius", NpgsqlDbType.Double) { Value = request.RadiusMeters },
            new NpgsqlParameter("style", NpgsqlDbType.Text) { Value = BufferStyle });

        var matches = await FacilitiesWithDistanceAsync(distances.Take(request.Limit).ToList(), withRank: false, cancellationToken);
        return Ok("buffer", InputFeature(bufferPolygon, "buffer", request.Source, label),
            new GeoJsonFeatureCollection(matches, new PageMeta(matches.Count, request.Limit, 0, distances.Count > request.Limit)),
            new Dictionary<string, object?>
            {
                ["radiusMeters"] = request.RadiusMeters,
                ["excludeSource"] = request.ExcludeSource,
                ["method"] = "ST_DWithin(geography) — WGS84 sferoidi üzerinde metre",
                ["bufferNote"] = "Çizilen tampon 64 kenarlı yaklaşık poligondur; seçim kesin mesafeyle (ST_DWithin) yapılır.",
            });
    }

    public async Task<AnalysisResult> NearestAsync(NearestRequest request, CancellationToken cancellationToken)
    {
        // Kesin referans sıralama: tüm aday tesislerde sferoid mesafesi + id bağ kırıcı. 4326 <-> (derece) kullanılmaz.
        const string sql = """
            SELECT f.id, ST_Distance(f.geom::geography, @p::geography) AS distance_meters
            FROM health_facilities f
            WHERE f.source_deleted_at IS NULL
              AND (@type::text IS NULL OR f.facility_type = @type::text)
              AND (@max::float8 IS NULL OR ST_DWithin(f.geom::geography, @p::geography, @max::float8))
            ORDER BY distance_meters, f.id
            LIMIT @n
            """;
        var distances = await QueryDistancesAsync(sql, cancellationToken,
            Geo("p", request.Point),
            new NpgsqlParameter("type", NpgsqlDbType.Text) { Value = (object?)request.FacilityType ?? DBNull.Value },
            new NpgsqlParameter("max", NpgsqlDbType.Double) { Value = (object?)request.MaxDistanceMeters ?? DBNull.Value },
            new NpgsqlParameter("n", NpgsqlDbType.Integer) { Value = request.N });

        var matches = await FacilitiesWithDistanceAsync(distances, withRank: true, cancellationToken);
        var input = new GeoJsonFeature("analysis-input", request.Point, new Dictionary<string, object?> { ["role"] = "point" });
        return Ok("nearest", input,
            new GeoJsonFeatureCollection(matches, new PageMeta(matches.Count, request.N, 0, false)),
            new Dictionary<string, object?>
            {
                ["n"] = request.N,
                ["type"] = request.FacilityType,
                ["maxDistanceMeters"] = request.MaxDistanceMeters,
                ["method"] = "ST_Distance(geography) sıralaması + id; kuş uçuşu mesafe (yol ağı değil)",
            });
    }

    // --- kaynak çözümleme ---

    private async Task<(AnalysisStatus Status, Geometry? Geometry, long? FacilityId, string? Label)> ResolveAsync(
        AnalysisInput input, CancellationToken cancellationToken)
    {
        if (input.Geometry is { } direct) return (AnalysisStatus.Ok, direct, null, "Çizilen geometri");

        var source = input.Source!;
        switch (source.LayerId)
        {
            case AnalysisLayers.Districts:
            {
                var id = long.Parse(source.Id);
                var row = await db.Districts.AsNoTracking().Where(d => d.Id == id && d.SourceDeletedAt == null)
                    .Select(d => new { d.Geom, Name = d.Override != null && d.Override.Name != null ? d.Override.Name : d.Name })
                    .SingleOrDefaultAsync(cancellationToken);
                return row is null ? NotFound() : (AnalysisStatus.Ok, row.Geom, null, row.Name);
            }
            case AnalysisLayers.Facilities:
            {
                var id = long.Parse(source.Id);
                var row = await db.HealthFacilities.AsNoTracking().Where(f => f.Id == id && f.SourceDeletedAt == null)
                    .Select(f => new { f.Geom, Name = f.Override != null && f.Override.Name != null ? f.Override.Name : f.Name })
                    .SingleOrDefaultAsync(cancellationToken);
                return row is null ? NotFound() : (AnalysisStatus.Ok, row.Geom, id, row.Name);
            }
            default:
            {
                var id = Guid.Parse(source.Id);
                var row = await db.UserFeatures.AsNoTracking().Where(f => f.Id == id)
                    .Select(f => new { f.Geom, f.Name }).SingleOrDefaultAsync(cancellationToken);
                return row is null ? NotFound() : (AnalysisStatus.Ok, row.Geom, null, row.Name);
            }
        }

        static (AnalysisStatus, Geometry?, long?, string?) NotFound() =>
            (AnalysisStatus.SourceNotFound, null, null, "Kaynak obje bulunamadı (silinmiş olabilir).");
    }

    // --- SQL yardımcıları ---

    private static NpgsqlParameter Geo(string name, Geometry geometry) =>
        new(name, NpgsqlDbType.Geometry) { Value = geometry };

    private async Task<DbConnection> OpenAsync(CancellationToken cancellationToken)
    {
        var connection = db.Database.GetDbConnection();
        if (connection.State != System.Data.ConnectionState.Open) await db.Database.OpenConnectionAsync(cancellationToken);
        return connection;
    }

    private async Task<List<(long Id, double DistanceMeters)>> QueryDistancesAsync(
        string sql, CancellationToken cancellationToken, params NpgsqlParameter[] parameters)
    {
        var connection = await OpenAsync(cancellationToken);
        await using var command = connection.CreateCommand();
        command.CommandText = sql;
        command.Parameters.AddRange(parameters);
        var result = new List<(long, double)>();
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        while (await reader.ReadAsync(cancellationToken)) result.Add((reader.GetInt64(0), reader.GetDouble(1)));
        return result;
    }

    private async Task<Geometry> ScalarGeometryAsync(string sql, CancellationToken cancellationToken, params NpgsqlParameter[] parameters)
    {
        var connection = await OpenAsync(cancellationToken);
        await using var command = connection.CreateCommand();
        command.CommandText = sql;
        command.Parameters.AddRange(parameters);
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        await reader.ReadAsync(cancellationToken);
        return reader.GetFieldValue<Geometry>(0);
    }

    private async Task<List<GeoJsonFeature>> FacilitiesWithDistanceAsync(
        List<(long Id, double DistanceMeters)> distances, bool withRank, CancellationToken cancellationToken)
    {
        var ids = distances.Select(d => d.Id).ToList();
        var rows = await db.HealthFacilities.AsNoTracking().Where(f => ids.Contains(f.Id))
            .Select(SourceFeatureQueries.FacilityRow).ToDictionaryAsync(r => r.Id, cancellationToken);

        // SQL sırası (mesafe, id) korunur.
        return distances.Select((d, index) =>
        {
            var feature = SourceFeatureQueries.ToFeature(rows[d.Id], detail: false, districtName: null);
            var props = new Dictionary<string, object?>(feature.Properties) { ["distanceMeters"] = d.DistanceMeters };
            if (withRank) props["rank"] = index + 1;
            return feature with { Properties = props };
        }).ToList();
    }

    private static GeoJsonFeature InputFeature(Geometry geometry, string role, AnalysisInput input, string? label) =>
        new("analysis-input", geometry, new Dictionary<string, object?>
        {
            ["role"] = role,
            ["sourceLayer"] = input.Source?.LayerId,
            ["sourceId"] = input.Source?.Id,
            ["label"] = label,
        });

    private static AnalysisResult Ok(string analysis, GeoJsonFeature input, GeoJsonFeatureCollection matches, Dictionary<string, object?> parameters) =>
        new(AnalysisStatus.Ok, new AnalysisResponse(analysis, input, matches, parameters));
}
