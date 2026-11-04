namespace GeoScope.Domain.Sources;

/// <summary>
/// Dış kaynak nesnesinin kimliği. OSM'de node/way/relation sayısal ID'leri ayrı uzaylardır;
/// tek başına ID benzersiz değildir, bu yüzden üçlü anahtar kullanılır.
/// </summary>
public static class SourceObjectTypes
{
    public const string Node = "node";
    public const string Way = "way";
    public const string Relation = "relation";

    public static readonly IReadOnlyList<string> All = [Node, Way, Relation];
}

public static class DataSources
{
    public const string OpenStreetMap = "osm";
}
