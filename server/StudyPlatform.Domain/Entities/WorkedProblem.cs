namespace StudyPlatform.Domain.Entities;

public class WorkedProblem
{
    public Guid WorkedProblemId { get; set; }
    public Guid UserId { get; set; }
    public Guid? DocumentId { get; set; }
    public Guid? VideoId { get; set; }
    public string ProblemText { get; set; } = string.Empty;
    public string StepsJson { get; set; } = "[]";
    public string FinalAnswer { get; set; } = string.Empty;
    public string Difficulty { get; set; } = "medium";
    public string? Topic { get; set; }
    public DateTime CreatedAt { get; set; }

    public User User { get; set; } = null!;
    public ICollection<WorkedProblemAttempt> Attempts { get; set; } = new List<WorkedProblemAttempt>();
}
