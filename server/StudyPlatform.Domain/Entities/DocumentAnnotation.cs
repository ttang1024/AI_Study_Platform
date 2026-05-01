namespace StudyPlatform.Domain.Entities;

public class DocumentAnnotation
{
    public Guid DocumentAnnotationId { get; set; }
    public Guid UserId { get; set; }
    public Guid DocumentId { get; set; }
    public string HighlightedText { get; set; } = string.Empty;
    public string? Note { get; set; }
    public string Color { get; set; } = "#FFFF00";
    public int PageNumber { get; set; }
    public string RectJson { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
    public User User { get; set; } = null!;
    public Document Document { get; set; } = null!;
}
