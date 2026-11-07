namespace GeoMosk.Application.Analysis;

/// <summary>
/// A05 — ilçe başına tesis sayısı (tekil atama). Her tesis en çok bir ilçeye sayılır:
/// sınır dahil kapsayan ilçeler arasından önce tesisi iç bölgesinde içeren (ST_Contains), eşitlikte en küçük ilçe id'si.
/// Hiçbir ilçenin kapsamadığı tesisler <see cref="DistrictStatsTotals.Unassigned"/> içindedir.
/// </summary>
public sealed record DistrictStatsResponse(
    string Analysis,
    string? FacilityType,
    IReadOnlyList<DistrictStatsRow> Districts,
    DistrictStatsTotals Totals,
    string Policy);

/// <param name="MultiMatchCount">Bu ilçeye atanan ama birden çok ilçenin kapsadığı (sınırdaki) tesis sayısı.</param>
public sealed record DistrictStatsRow(long Id, string Name, int FacilityCount, int MultiMatchCount);

/// <summary><c>Facilities = Assigned + Unassigned</c>; ilçe sayılarının toplamı <c>Assigned</c>'a eşittir (çifte sayım yok).</summary>
public sealed record DistrictStatsTotals(int Facilities, int Assigned, int Unassigned, int MultiMatch);
