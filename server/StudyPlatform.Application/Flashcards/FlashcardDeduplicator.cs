using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using StudyPlatform.Application.Services;
using StudyPlatform.Application.Settings;

namespace StudyPlatform.Application.Flashcards;

/// <inheritdoc cref="IFlashcardDeduplicator"/>
public class FlashcardDeduplicator : IFlashcardDeduplicator
{
    private readonly IEmbeddingService _embeddings;
    private readonly IEmbeddingIndex _index;
    private readonly EmbeddingOptions _options;
    private readonly ILogger<FlashcardDeduplicator> _logger;

    public FlashcardDeduplicator(
        IEmbeddingService embeddings,
        IEmbeddingIndex index,
        IOptions<EmbeddingOptions> options,
        ILogger<FlashcardDeduplicator> logger)
    {
        _embeddings = embeddings;
        _index = index;
        _options = options.Value;
        _logger = logger;
    }

    /// <summary>
    /// A card's meaning lives in the question and the answer together: "What year?" / "1789" and
    /// "What year?" / "1804" are different cards with near-identical fronts. Embedding both sides is
    /// what stops the second from being discarded as a duplicate of the first.
    /// </summary>
    private static string TextOf(string front, string back)
        => string.IsNullOrWhiteSpace(back) ? front : $"{front}\n{back}";

    public async Task<FlashcardDedupResult> FilterAsync(
        Guid userId,
        IReadOnlyList<FlashcardCandidate> candidates,
        CancellationToken cancellationToken = default)
    {
        if (!_embeddings.IsEnabled || candidates.Count == 0)
            return FlashcardDedupResult.KeepAll(candidates);

        IReadOnlyList<float[]> vectors;
        try
        {
            // One batched request for the whole generation, not one per card.
            vectors = await _embeddings.EmbedAsync(
                candidates.Select(c => TextOf(c.Front, c.Back)).ToList(), cancellationToken);
        }
        catch (Exception ex)
        {
            // Deduplication is a nicety; losing the user's generated cards because the embeddings
            // provider had a bad minute is not an acceptable trade.
            _logger.LogWarning(ex, "Could not embed candidate flashcards; skipping deduplication");
            return FlashcardDedupResult.KeepAll(candidates);
        }

        if (vectors.Count != candidates.Count)
        {
            _logger.LogWarning(
                "Embeddings returned {Vectors} vectors for {Candidates} candidate flashcards; skipping deduplication",
                vectors.Count, candidates.Count);
            return FlashcardDedupResult.KeepAll(candidates);
        }

        var kept = new List<FlashcardCandidate>(candidates.Count);
        var keptVectors = new List<float[]>(candidates.Count);
        var duplicateOfExisting = new List<FlashcardCandidate>();
        var duplicateWithinBatch = new List<FlashcardCandidate>();

        for (var i = 0; i < candidates.Count; i++)
        {
            var candidate = candidates[i];
            var vector = vectors[i];

            // Against the library. Only the single nearest card matters — if that one is far enough
            // away, nothing else can be closer.
            var nearest = await _index.FindNearestAsync(
                userId, vector, EmbeddingSourceTypes.Flashcard, 1, cancellationToken);

            if (nearest.Count > 0 && nearest[0].Distance <= _options.DuplicateDistance)
            {
                duplicateOfExisting.Add(candidate);
                continue;
            }

            // Against the cards kept so far from this same batch. Compared in memory: these are not in
            // the index yet, and will not be until the caller saves and indexes them.
            if (keptVectors.Any(v => CosineDistance(v, vector) <= _options.DuplicateDistance))
            {
                duplicateWithinBatch.Add(candidate);
                continue;
            }

            kept.Add(candidate);
            keptVectors.Add(vector);
        }

        if (duplicateOfExisting.Count > 0 || duplicateWithinBatch.Count > 0)
        {
            _logger.LogInformation(
                "Dropped {Existing} flashcard(s) already in the library and {Batch} repeated within the batch, keeping {Kept}",
                duplicateOfExisting.Count, duplicateWithinBatch.Count, kept.Count);
        }

        return new FlashcardDedupResult(kept, duplicateOfExisting, duplicateWithinBatch);
    }

    public async Task IndexAsync(
        Guid userId,
        IReadOnlyList<(Guid FlashcardId, string Front, string Back)> flashcards,
        CancellationToken cancellationToken = default)
    {
        if (!_embeddings.IsEnabled || flashcards.Count == 0)
            return;

        foreach (var (flashcardId, front, back) in flashcards)
        {
            try
            {
                await _index.IndexSourceAsync(
                    userId,
                    EmbeddingSourceTypes.Flashcard,
                    flashcardId,
                    front,
                    TextOf(front, back),
                    cancellationToken);
            }
            catch (Exception ex)
            {
                // The card is already saved and is what the user asked for. Failing to index it only
                // means it will not be available to deduplicate against later.
                _logger.LogWarning(ex, "Could not index flashcard {FlashcardId} for deduplication", flashcardId);
            }
        }
    }

    /// <summary>
    /// Cosine distance, matching pgvector's <c>&lt;=&gt;</c> operator so the in-batch comparison and the
    /// index probe are measured on the same scale and can share one threshold.
    /// </summary>
    private static double CosineDistance(float[] a, float[] b)
    {
        if (a.Length != b.Length || a.Length == 0)
            return 1;

        double dot = 0, magA = 0, magB = 0;
        for (var i = 0; i < a.Length; i++)
        {
            dot += (double)a[i] * b[i];
            magA += (double)a[i] * a[i];
            magB += (double)b[i] * b[i];
        }

        if (magA == 0 || magB == 0)
            return 1;

        return 1 - (dot / (Math.Sqrt(magA) * Math.Sqrt(magB)));
    }
}
