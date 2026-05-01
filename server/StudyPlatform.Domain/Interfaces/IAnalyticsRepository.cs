using StudyPlatform.Domain.Entities;

namespace StudyPlatform.Domain.Interfaces;

public interface IAnalyticsRepository
{
    Task<IEnumerable<QuizAttempt>> GetQuizAttemptsByDateRangeAsync(Guid userId, DateTime from, DateTime to, CancellationToken cancellationToken = default);
    Task AddQuizAttemptAsync(QuizAttempt attempt, CancellationToken cancellationToken = default);
}
