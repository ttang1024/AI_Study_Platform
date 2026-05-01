namespace StudyPlatform.Domain.Entities;

public class GlossaryMastered
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    public Guid GlossaryTermId { get; set; }
    public DateTime MasteredAt { get; set; }

    public GlossaryTerm? GlossaryTerm { get; set; }
}
