namespace GeoScope.Application.Health;

/// <summary>Veritabanı ve PostGIS kullanılabilirliğini sorgulayan port; uygulaması Infrastructure'dadır.</summary>
public interface IDatabaseStatusProbe
{
    Task<DatabaseStatus> CheckAsync(CancellationToken cancellationToken);
}

public sealed record DatabaseStatus(bool IsAvailable, string? PostGisVersion)
{
    public static DatabaseStatus Unavailable { get; } = new(false, null);
}
