namespace StudyPlatform.Domain.Entities;

public class Flashcard
{
    public Guid FlashcardId { get; set; }
    public Guid? DocumentId { get; set; }
    public Guid? YouTubeVideoId { get; set; }
    public string SourceType { get; set; } = "document"; // "document" | "video"
    public Guid UserId { get; set; }
    public string Front { get; set; } = string.Empty;
    public string Back { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
    public Document? Document { get; set; }
    public YouTubeVideo? YouTubeVideo { get; set; }
}
