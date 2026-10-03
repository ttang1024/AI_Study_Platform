namespace StudyPlatform.Domain.Entities;

public class ChatConversation
{
    public Guid ConversationId { get; set; }
    public Guid UserId { get; set; }
    /// <summary>Set when this is one of a video's chat threads; null otherwise.</summary>
    public Guid? VideoId { get; set; }
    /// <summary>Set when this is one of a document's chat threads; null otherwise. Both null = standalone (general tutor) conversation.</summary>
    public Guid? DocumentId { get; set; }
    public string Title { get; set; } = "New conversation";
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
    public Video? Video { get; set; }
    public Document? Document { get; set; }
    public ICollection<ChatMessage> Messages { get; set; } = new List<ChatMessage>();
}
