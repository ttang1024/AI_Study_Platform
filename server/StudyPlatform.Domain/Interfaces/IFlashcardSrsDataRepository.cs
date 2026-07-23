using StudyPlatform.Domain.Entities;

namespace StudyPlatform.Domain.Interfaces;

public interface IFlashcardSrsDataRepository : IRepository<FlashcardSrsData>
{
    Task<FlashcardSrsData?> GetByUserAndFlashcardAsync(Guid userId, Guid flashcardId, CancellationToken ct = default);
    Task<IEnumerable<FlashcardSrsData>> GetByUserIdAsync(Guid userId, CancellationToken ct = default);
    Task<IEnumerable<FlashcardSrsData>> GetDueByUserIdAsync(Guid userId, DateTime asOf, CancellationToken ct = default);

    /// <summary>How many cards are due, counted in the database — for callers that only render the number.</summary>
    Task<int> CountDueByUserIdAsync(Guid userId, DateTime asOf, CancellationToken ct = default);
}
