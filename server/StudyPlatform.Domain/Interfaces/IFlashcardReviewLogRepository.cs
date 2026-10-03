using StudyPlatform.Domain.Entities;

namespace StudyPlatform.Domain.Interfaces;

public interface IFlashcardReviewLogRepository : IRepository<FlashcardReviewLog>
{
    Task<IEnumerable<FlashcardReviewLog>> GetByUserAsync(Guid userId, DateTime? since = null, CancellationToken cancellationToken = default);

    /// <summary>The user's most recent review, optionally restricted to one card. Null when they have none.</summary>
    Task<FlashcardReviewLog?> GetLatestAsync(Guid userId, Guid? flashcardId = null, CancellationToken cancellationToken = default);

    /// <summary>The review of <paramref name="flashcardId"/> immediately preceding <paramref name="before"/>.</summary>
    Task<FlashcardReviewLog?> GetPreviousAsync(Guid userId, Guid flashcardId, DateTime before, CancellationToken cancellationToken = default);
}
