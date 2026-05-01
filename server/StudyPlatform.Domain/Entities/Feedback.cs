namespace StudyPlatform.Domain.Entities;

public class Feedback
{
    public Guid Id { get; set; }
    public string Type { get; set; } = string.Empty;        // bug | feature | general
    public string Status { get; set; } = "new";             // new | read | in_progress | resolved | archived
    public string Subject { get; set; } = string.Empty;
    public string Message { get; set; } = string.Empty;
    public int? Rating { get; set; }
    public DateTime SubmittedAt { get; set; }
    public Guid? UserId { get; set; }
    public string? UserEmail { get; set; }
    public string? AdminNote { get; set; }
    public DateTime? ResolvedAt { get; set; }
}
