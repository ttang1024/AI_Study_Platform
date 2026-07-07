namespace StudyPlatform.Domain.Entities;

public class GlossaryTerm
{
    public Guid GlossaryTermId { get; set; }
    public Guid? DocumentId { get; set; }
    public Guid? VideoId { get; set; }
    public Guid UserId { get; set; }
    public string Term { get; set; } = string.Empty;
    public string Definition { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }

    public Document? Document { get; set; }
    public Video? Video { get; set; }
}
