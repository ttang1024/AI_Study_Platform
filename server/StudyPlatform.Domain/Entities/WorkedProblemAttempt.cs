namespace StudyPlatform.Domain.Entities;

public class WorkedProblemAttempt
{
    public Guid WorkedProblemAttemptId { get; set; }
    public Guid UserId { get; set; }
    public Guid WorkedProblemId { get; set; }
    public string UserAnswer { get; set; } = string.Empty;
    public string? AiEvaluation { get; set; }
    public bool? IsCorrect { get; set; }
    public DateTime AttemptedAt { get; set; }

    public User User { get; set; } = null!;
    public WorkedProblem WorkedProblem { get; set; } = null!;
}
