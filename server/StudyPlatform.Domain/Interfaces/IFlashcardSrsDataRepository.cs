using StudyPlatform.Domain.Entities;

namespace StudyPlatform.Domain.Interfaces;

public interface IFlashcardSrsDataRepository : IRepository<FlashcardSrsData>
{
    Task<FlashcardSrsData?> GetByUserAndFlashcardAsync(Guid userId, Guid flashcardId, CancellationToken ct = default);
    Task<IEnumerable<FlashcardSrsData>> GetByUserIdAsync(Guid userId, CancellationToken ct = default);
    Task<IEnumerable<FlashcardSrsData>> GetDueByUserIdAsync(Guid userId, DateTime asOf, CancellationToken ct = default);

    /// <summary>How many cards are due, counted in the database — for callers that only render the number.</summary>
    Task<int> CountDueByUserIdAsync(Guid userId, DateTime asOf, CancellationToken ct = default);

    /// <summary>
    /// Due-card counts per calendar day over <paramref name="from"/>..<paramref name="to"/> (inclusive),
    /// grouped in the database. Powers the review forecast and lets the scheduler steer a new
    /// interval toward a quiet day. Days with nothing due are absent, not zero.
    /// </summary>
    Task<IReadOnlyDictionary<DateTime, int>> GetDueCountsByDayAsync(
        Guid userId, DateTime from, DateTime to, CancellationToken cancellationToken = default);

    /// <summary>
    /// Overdue cards (Due &lt; <paramref name="asOf"/>), oldest first — the backlog a returning
    /// user faces, in the order it should be worked through.
    /// </summary>
    Task<IReadOnlyList<FlashcardSrsData>> GetOverdueByUserIdAsync(
        Guid userId, DateTime asOf, CancellationToken cancellationToken = default);

    /// <summary>
    /// Cards the user keeps failing (Lapses ≥ <paramref name="minLapses"/>), worst first,
    /// paired with the card itself so callers can render front/back without a second query.
    /// </summary>
    Task<IReadOnlyList<(FlashcardSrsData Srs, Flashcard Card)>> GetLeechesByUserIdAsync(
        Guid userId, int minLapses, CancellationToken ct = default);
}
