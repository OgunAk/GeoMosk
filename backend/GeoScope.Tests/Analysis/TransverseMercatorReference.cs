namespace GeoScope.Tests.Analysis;

/// <summary>
/// A04 için PostGIS'ten bağımsız referans (WGS84 elipsoidi, kapalı formüller):
/// <list type="bullet">
/// <item>Enlem/boylam dörtgeninin elipsoid üzerindeki tam alanı (yetkili enlem q fonksiyonu).</item>
/// <item>Enine Merkator (UTM) nokta ölçek faktörü k (Snyder, "Map Projections — A Working Manual", 1987, denklem 8-11).
/// UTM konform olduğundan alan ölçeği k², uzunluk ölçeği k'dir.</item>
/// </list>
/// Beklenen projeksiyon değeri = elipsoid değeri × k (veya k²), k şeklin merkezinde. Küçük (≈1 km) şekillerde
/// k'nin şekil içindeki değişimi 10⁻⁷ mertebesindedir; seri kesme hatası A⁸ ≈ 10⁻¹³.
/// </summary>
public static class TransverseMercatorReference
{
    private const double A = 6_378_137.0;
    private const double F = 1 / 298.257223563;
    private static readonly double E2 = F * (2 - F);
    private static readonly double E = Math.Sqrt(E2);
    private static readonly double Ep2 = E2 / (1 - E2);

    public const double Utm35CentralMeridian = 27.0;
    public const double UtmK0 = 0.9996;

    private static double Rad(double deg) => deg * Math.PI / 180;

    private static double Q(double latDeg)
    {
        var s = Math.Sin(Rad(latDeg));
        return (1 - E2) * (s / (1 - E2 * s * s) - 1 / (2 * E) * Math.Log((1 - E * s) / (1 + E * s)));
    }

    /// <summary>İki paralel ve iki meridyen arasındaki elipsoid alanı (m²), tam formül.</summary>
    public static double QuadrangleArea(double lon1, double lat1, double lon2, double lat2) =>
        A * A / 2 * Math.Abs(Rad(lon2 - lon1)) * Math.Abs(Q(lat2) - Q(lat1));

    /// <summary>UTM 35N nokta ölçek faktörü k.</summary>
    public static double UtmScale(double lonDeg, double latDeg)
    {
        var phi = Rad(latDeg);
        var a = Rad(lonDeg - Utm35CentralMeridian) * Math.Cos(phi);
        var t = Math.Pow(Math.Tan(phi), 2);
        var c = Ep2 * Math.Pow(Math.Cos(phi), 2);
        return UtmK0 * (1
            + (1 + c) * a * a / 2
            + (5 - 4 * t + 42 * c + 13 * c * c - 28 * Ep2) * Math.Pow(a, 4) / 24
            + (61 - 148 * t + 16 * t * t) * Math.Pow(a, 6) / 720);
    }

    /// <summary>Dörtgenin UTM 35N'deki beklenen alanı: elipsoid alanı × k²(merkez).</summary>
    public static double UtmQuadrangleArea(double lon1, double lat1, double lon2, double lat2)
    {
        var k = UtmScale((lon1 + lon2) / 2, (lat1 + lat2) / 2);
        return QuadrangleArea(lon1, lat1, lon2, lat2) * k * k;
    }
}
