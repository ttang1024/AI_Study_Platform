namespace StudyPlatform.Domain.Entities;

public class ChatConversation
{
    public Guid ConversationId { get; set; }
    public Guid UserId { get; set; }
    public string Title { get; set; } = "New conversation";
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
    public ICollection<ChatMessage> Messages { get; set; } = new List<ChatMessage>();
}
