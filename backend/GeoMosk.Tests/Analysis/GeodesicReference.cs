namespace GeoMosk.Tests.Analysis;

/// <summary>
/// PostGIS'ten bağımsız referans: WGS84 elipsoidinde küçük yayların uzunluğu.
/// Kuzey-güney: meridyen eğrilik yarıçapı M(φ); doğu-batı (aynı enlem): N(φ)·cosφ.
/// Birkaç km'lik mesafelerde bu yaklaşımın hatası milimetre altıdır; jeodezik ile paralel yayı arasındaki fark da ihmal edilebilir.
/// Amaç, sonuçları aynı PostGIS fonksiyonuyla "doğrulamak" yerine ayrı bir hesapla karşılaştırmaktır.
/// </summary>
public static class GeodesicReference
{
    private const double A = 6_378_137.0;                 // WGS84 büyük yarı eksen (m)
    private const double F = 1 / 298.257223563;           // basıklık
    private static readonly double E2 = F * (2 - F);      // birinci dışmerkezlik karesi

    private static double Rad(double deg) => deg * Math.PI / 180;

    /// <summary>Meridyen eğrilik yarıçapı M(φ).</summary>
    public static double MeridianRadius(double latDeg)
    {
        var s = Math.Sin(Rad(latDeg));
        return A * (1 - E2) / Math.Pow(1 - E2 * s * s, 1.5);
    }

    /// <summary>Birinci düşey eğrilik yarıçapı N(φ).</summary>
    public static double PrimeVerticalRadius(double latDeg)
    {
        var s = Math.Sin(Rad(latDeg));
        return A / Math.Sqrt(1 - E2 * s * s);
    }

    /// <summary>Aynı meridyende iki enlem arası (orta enlemde M ile).</summary>
    public static double NorthSouthMeters(double lat1, double lat2) =>
        MeridianRadius((lat1 + lat2) / 2) * Math.Abs(Rad(lat2 - lat1));

    /// <summary>Aynı enlemde iki boylam arası.</summary>
    public static double EastWestMeters(double lat, double lon1, double lon2) =>
        PrimeVerticalRadius(lat) * Math.Cos(Rad(lat)) * Math.Abs(Rad(lon2 - lon1));

    /// <summary>Verilen enlemden kuzeye <paramref name="meters"/> metre giden noktanın enlemi.</summary>
    public static double LatitudeNorthOf(double lat, double meters)
    {
        // M enlemle çok az değiştiği için iki adım yeterli.
        var dLat = meters / MeridianRadius(lat) * 180 / Math.PI;
        return lat + meters / MeridianRadius(lat + dLat / 2) * 180 / Math.PI;
    }
}
