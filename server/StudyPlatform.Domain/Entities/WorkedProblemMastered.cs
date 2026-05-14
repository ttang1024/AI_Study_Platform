namespace StudyPlatform.Domain.Entities;

public class WorkedProblemMastered
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    public Guid WorkedProblemId { get; set; }
    public DateTime MasteredAt { get; set; }

    public WorkedProblem? WorkedProblem { get; set; }
}
