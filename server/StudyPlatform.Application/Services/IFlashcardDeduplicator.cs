namespace StudyPlatform.Application.Services;

/// <summary>A freshly generated card, before it has been persisted.</summary>
/// <param name="Key">Whatever the caller needs to map the verdict back to its own object.</param>
public sealed record FlashcardCandidate(int Key, string Front, string Back);

/// <param name="Kept">Candidates that survived — these are new cards.</param>
/// <param name="DuplicateOfExisting">Candidates that duplicate a card already in the library.</param>
/// <param name="DuplicateWithinBatch">Candidates that duplicate an earlier candidate in the same batch.</param>
public sealed record FlashcardDedupResult(
    IReadOnlyList<FlashcardCandidate> Kept,
    IReadOnlyList<FlashcardCandidate> DuplicateOfExisting,
    IReadOnlyList<FlashcardCandidate> DuplicateWithinBatch)
{
    public int DuplicateCount => DuplicateOfExisting.Count + DuplicateWithinBatch.Count;

    /// <summary>The "embeddings are off" answer: nothing is a duplicate, everything is kept.</summary>
    public static FlashcardDedupResult KeepAll(IReadOnlyList<FlashcardCandidate> candidates)
        => new(candidates, [], []);
}

/// <summary>
/// Drops generated flashcards that say the same thing as a card the user already has.
///
/// Generating cards from two documents that cover the same topic — lecture slides and the textbook
/// chapter behind them — produces the same facts twice, in different words. Exact-text matching cannot
/// see that; embeddings can. This compares candidates against the user's existing cards *and* against
/// each other, since one generation can also emit the same fact twice.
///
/// Degrades to keeping everything when embeddings are unconfigured — the platform rule is that a missing
/// optional key turns a feature off, it does not fail the request.
/// </summary>
public interface IFlashcardDeduplicator
{
    Task<FlashcardDedupResult> FilterAsync(
        Guid userId,
        IReadOnlyList<FlashcardCandidate> candidates,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Adds saved cards to the index so later generations can be deduplicated against them. Call after
    /// the cards are persisted; a card indexed before its insert commits would be a phantom duplicate.
    /// </summary>
    Task IndexAsync(
        Guid userId,
        IReadOnlyList<(Guid FlashcardId, string Front, string Back)> flashcards,
        CancellationToken cancellationToken = default);
}
