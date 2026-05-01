namespace StudyPlatform.Domain.Entities;

public class ConceptLink
{
    public Guid ConceptLinkId { get; set; }
    public Guid UserId { get; set; }
    public string SourceEntityType { get; set; } = string.Empty; // "document" | "note" | "flashcard" | "glossary"
    public Guid SourceEntityId { get; set; }
    public string TargetEntityType { get; set; } = string.Empty;
    public Guid TargetEntityId { get; set; }
    public string? LinkLabel { get; set; } // "relates to" | "defines" | "expands on" | "contradicts"
    public DateTime CreatedAt { get; set; }
    public User User { get; set; } = null!;
}
