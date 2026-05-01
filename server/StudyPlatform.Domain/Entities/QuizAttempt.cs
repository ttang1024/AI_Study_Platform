namespace StudyPlatform.Domain.Entities;

public class QuizAttempt
{
    public Guid AttemptId { get; set; }
    public Guid UserId { get; set; }
    public Guid QuizId { get; set; }
    public bool IsCorrect { get; set; }
    public DateTime AttemptedAt { get; set; }
}
