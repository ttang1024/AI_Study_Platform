namespace StudyPlatform.Domain.Entities;

public class ChatMessage
{
    public Guid MessageId { get; set; }
    public Guid? DocumentId { get; set; }
    public Guid? YouTubeVideoId { get; set; }
    public string SourceType { get; set; } = "document"; // "document" | "video"
    public Guid UserId { get; set; }
    public string Role { get; set; } = string.Empty; // "user" or "assistant"
    public string Content { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }
    public Document? Document { get; set; }
    public YouTubeVideo? YouTubeVideo { get; set; }
}
