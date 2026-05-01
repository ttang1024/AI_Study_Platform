namespace StudyPlatform.Domain.Entities;

public class ShareToken
{
    public Guid Id { get; set; }
    public string Token { get; set; } = default!;
    public Guid OwnerId { get; set; }
    public string Title { get; set; } = default!;
    public string? Summary { get; set; }
    public string? MindMapText { get; set; }
    public string? NotesHtml { get; set; }
    public string? QuizzesJson { get; set; }
    public string? FlashcardsJson { get; set; }
    public string? GlossaryJson { get; set; }
    public string? SourceType { get; set; }  // "youtube" | "article" | "audio" | "document"
    public string? SourceUrl { get; set; }
    public string? OriginalArticleUrl { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? ExpiresAt { get; set; }
    public User? Owner { get; set; }
}
