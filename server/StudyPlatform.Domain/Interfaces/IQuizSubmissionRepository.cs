using StudyPlatform.Domain.Entities;

namespace StudyPlatform.Domain.Interfaces;

/// <summary>
/// Quiz achievements over a user's whole history. Submissions with no questions (Total == 0) are
/// excluded — they cannot be perfect and have no score to average.
/// </summary>
public record QuizAchievements(int PerfectCount, int ScoredCount, double AverageScorePercent)
{
    public static readonly QuizAchievements Empty = new(0, 0, 0);
}

public interface IQuizSubmissionRepository : IRepository<QuizSubmission>
{
    /// <summary>
    /// Perfect-score count and mean score, aggregated in the database. The alternative is loading every
    /// submission a user has ever made just to average three numbers.
    /// </summary>
    Task<QuizAchievements> GetAchievementsAsync(Guid userId, CancellationToken cancellationToken = default);

    Task<QuizSubmission?> GetByDocumentAndUserAsync(Guid documentId, Guid userId, CancellationToken cancellationToken = default);
    Task<QuizSubmission?> GetByVideoAndUserAsync(Guid videoId, Guid userId, CancellationToken cancellationToken = default);
    Task<IEnumerable<QuizSubmission>> GetAllByUserAsync(Guid userId, CancellationToken cancellationToken = default);
    Task<IEnumerable<QuizSubmission>> GetByDateRangeAsync(Guid userId, DateTime from, DateTime to, CancellationToken cancellationToken = default);
    Task<(IEnumerable<QuizSubmission> Items, int TotalCount)> GetPagedByUserAsync(Guid userId, int page, int pageSize, CancellationToken cancellationToken = default);
    Task<(IEnumerable<Guid> DocumentIds, IEnumerable<Guid> VideoIds)> GetCoverageByUserAsync(Guid userId, CancellationToken cancellationToken = default);
}
