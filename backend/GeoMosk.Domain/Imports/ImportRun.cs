namespace GeoMosk.Domain.Imports;

/// <summary>Bir import denemesinin kaydı; başarısız denemeler de saklanır.</summary>
public sealed class ImportRun
{
    public long Id { get; set; }
    public required string Source { get; set; }
    public required string Dataset { get; set; }
    public required string SnapshotId { get; set; }
    public required string Checksum { get; set; }
    public string? Query { get; set; }
    public DateTimeOffset? SourceTimestamp { get; set; }
    public DateTimeOffset StartedAt { get; set; }
    public DateTimeOffset? FinishedAt { get; set; }
    public required string Status { get; set; }
    public int Processed { get; set; }
    public int Inserted { get; set; }
    public int Updated { get; set; }
    public int Unchanged { get; set; }
    public int Rejected { get; set; }
    public int MarkedDeleted { get; set; }
    public string? ErrorSummary { get; set; }
    public string? QualityReport { get; set; }
}
