namespace StudyPlatform.Domain.Entities;

public class YouTubeTranscriptEntry
{
    public string VideoId { get; set; } = string.Empty;
    public string Kind { get; set; } = string.Empty;
    public string SegmentsJson { get; set; } = string.Empty;
    public DateTime ExpiresAt { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}
