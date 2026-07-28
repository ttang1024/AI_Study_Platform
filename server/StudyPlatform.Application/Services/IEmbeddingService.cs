namespace StudyPlatform.Application.Services;

/// <summary>Turns text into vectors. Disabled (and skipped everywhere) when no embedding key is configured.</summary>
public interface IEmbeddingService
{
    /// <summary>False when no API key is configured — callers fall back to keyword search rather than failing.</summary>
    bool IsEnabled { get; }

    /// <summary>The model these vectors come from. Vectors from different models are not comparable.</summary>
    string Model { get; }

    Task<IReadOnlyList<float[]>> EmbedAsync(IReadOnlyList<string> texts, CancellationToken cancellationToken = default);

    Task<float[]> EmbedOneAsync(string text, CancellationToken cancellationToken = default);
}

/// <summary>
/// The values a stored chunk's SourceType can take — one per kind of thing that gets
/// indexed. Prune uses this set to decide which table a chunk's SourceId should still exist in, so a
/// new source type has to be added here as well as wherever it is indexed.
/// </summary>
public static class EmbeddingSourceTypes
{
    public const string Document = "document";
    public const string Video = "video";
    public const string Note = "note";
    public const string Glossary = "glossary";
    public const string Flashcard = "flashcard";
}

/// <summary>A chunk retrieved by semantic similarity, with its cosine distance (0 = identical).</summary>
public sealed record EmbeddingHit(
    string SourceType,
    Guid SourceId,
    string Title,
    string Text,
    int ChunkIndex,
    double Distance);

/// <summary>Stores and retrieves the embedded chunks of a user's library.</summary>
public interface IEmbeddingIndex
{
    /// <summary>
    /// Re-indexes one source: chunks the text, embeds the chunks and replaces whatever was stored for
    /// it before. A no-op when embeddings are disabled or the text is empty.
    /// </summary>
    Task IndexSourceAsync(
        Guid userId,
        string sourceType,
        Guid sourceId,
        string title,
        string text,
        CancellationToken cancellationToken = default);

    Task RemoveSourceAsync(string sourceType, Guid sourceId, CancellationToken cancellationToken = default);

    /// <summary>
    /// Deletes chunks whose source row is gone, and returns how many.
    ///
    /// Sources are referenced by (SourceType, SourceId), which no foreign key can express, so nothing
    /// cleans these up on its own: a deleted document's chunks would otherwise stay searchable forever
    /// and answer queries with an excerpt of content that no longer exists. Sweeping is what makes this
    /// reliable — most deletions cascade (a course takes its documents, a document takes its flashcards
    /// and glossary terms), and the rows that vanish that way are never seen by a handler.
    ///
    /// Pass a <paramref name="userId"/> after deleting something on a request path: that restricts the
    /// work to one user's chunks, which is what the (UserId, SourceType, SourceId) index covers. Passing
    /// null scans everything and is meant for the background sweep.
    ///
    /// Never throws — cleanup failing is not a reason to fail the delete that triggered it.
    /// </summary>
    Task<int> PruneOrphansAsync(Guid? userId = null, CancellationToken cancellationToken = default);

    /// <summary>Nearest chunks to the query, restricted to this user and the given source types.</summary>
    Task<IReadOnlyList<EmbeddingHit>> SearchAsync(
        Guid userId,
        string query,
        IReadOnlyCollection<string> sourceTypes,
        int limit,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Nearest stored chunks to a vector the caller already has.
    ///
    /// <see cref="SearchAsync"/> embeds its query string on every call, which is the wrong shape for
    /// deduplication: that embeds a whole batch of candidates in one request and then probes the index
    /// once per candidate. Going through SearchAsync would re-embed each candidate individually.
    /// </summary>
    Task<IReadOnlyList<EmbeddingHit>> FindNearestAsync(
        Guid userId,
        float[] vector,
        string sourceType,
        int limit,
        CancellationToken cancellationToken = default);
}
