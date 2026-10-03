namespace StudyPlatform.Domain.Entities;

public class Note
{
    public Guid NoteId { get; set; }
    public Guid UserId { get; set; }
    public Guid? DocumentId { get; set; }
    public Guid? VideoId { get; set; }
    public string SourceType { get; set; } = "document"; // "document" | "video"
    public string Content { get; set; } = string.Empty;
    public string? Title { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
    public Document? Document { get; set; }
    public Video? Video { get; set; }
}
