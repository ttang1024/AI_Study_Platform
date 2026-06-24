namespace StudyPlatform.Domain.Entities;

public class ChatMessage
{
    public Guid MessageId { get; set; }
    public Guid? DocumentId { get; set; }
    public Guid? YouTubeVideoId { get; set; }
    public Guid? ChatConversationId { get; set; }
    public string SourceType { get; set; } = "document"; // "document" | "video" | "general"
    public Guid UserId { get; set; }
    public string Role { get; set; } = string.Empty; // "user" or "assistant"
    public string Content { get; set; } = string.Empty;
    /// <summary>JSON array of stored attachment metadata (blob URL, mime type, file name); null when the turn has no attachments.</summary>
    public string? AttachmentsJson { get; set; }
    public DateTime CreatedAt { get; set; }
    public Document? Document { get; set; }
    public YouTubeVideo? YouTubeVideo { get; set; }
    public ChatConversation? ChatConversation { get; set; }
}
