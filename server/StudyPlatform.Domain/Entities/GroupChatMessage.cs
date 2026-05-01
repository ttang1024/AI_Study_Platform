namespace StudyPlatform.Domain.Entities;

public class GroupChatMessage
{
    public Guid GroupChatMessageId { get; set; }
    public Guid GroupId { get; set; }
    public Guid UserId { get; set; }
    public string Content { get; set; } = string.Empty;
    public DateTime SentAt { get; set; }
    public StudyGroup Group { get; set; } = null!;
    public User User { get; set; } = null!;
}
