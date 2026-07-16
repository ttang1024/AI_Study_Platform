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
