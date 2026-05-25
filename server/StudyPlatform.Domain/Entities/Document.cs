namespace StudyPlatform.Domain.Entities;

public class Document
{
    public Guid DocumentId { get; set; }
    public Guid CourseId { get; set; }
    public Guid UserId { get; set; }
    public string FileName { get; set; } = string.Empty;
    public string BlobUrl { get; set; } = string.Empty;
    public string ContentType { get; set; } = string.Empty;
    public long FileSize { get; set; }
    public string? FileHash { get; set; }
    public string? Summary { get; set; }
    public string? MindMapText { get; set; }
    public string? Transcript { get; set; }
    public string? OriginalUrl { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
    public Course Course { get; set; } = null!;
    public User User { get; set; } = null!;
    public ICollection<Note> Notes { get; set; } = new List<Note>();
    public ICollection<Quiz> Quizzes { get; set; } = new List<Quiz>();
    public ICollection<Flashcard> Flashcards { get; set; } = new List<Flashcard>();
    public ICollection<ChatMessage> ChatMessages { get; set; } = new List<ChatMessage>();
}
