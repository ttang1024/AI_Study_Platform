using StudyPlatform.Domain.Entities;

namespace StudyPlatform.Domain.Interfaces;

public interface IFlashcardReviewLogRepository : IRepository<FlashcardReviewLog>
{
    Task<IEnumerable<FlashcardReviewLog>> GetByUserAsync(Guid userId, DateTime? since = null, CancellationToken cancellationToken = default);
}
