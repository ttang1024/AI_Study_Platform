namespace StudyPlatform.Application.Settings;

/// <summary>
/// Embeddings are infrastructure, not a per-user preference: the backfill worker indexes content
/// outside any request, so it cannot use the per-request X-AI-* keys the chat models run on. When no
/// ApiKey is configured, semantic search is simply off and everything falls back to keyword search.
/// </summary>
public class EmbeddingOptions
{
    public const string SectionName = "Embeddings";

    /// <summary>"openai" (or any OpenAI-compatible /v1/embeddings endpoint) or "gemini".</summary>
    public string Provider { get; set; } = "openai";

    public string Model { get; set; } = "text-embedding-3-small";

    public string? ApiKey { get; set; }

    /// <summary>Override for OpenAI-compatible providers that aren't OpenAI (Qwen, a local server, …).</summary>
    public string? BaseUrl { get; set; }

    /// <summary>How many chunks to send per embeddings request.</summary>
    public int BatchSize { get; set; } = 64;

    /// <summary>Minutes between backfill sweeps for content whose text has changed since it was indexed.</summary>
    public int BackfillIntervalMinutes { get; set; } = 15;

    /// <summary>Sources re-indexed per sweep. Caps the embedding spend of any single cycle.</summary>
    public int BackfillBatchSize { get; set; } = 25;

    /// <summary>
    /// Cosine distance below which two flashcards are treated as the same card (0 = identical text).
    /// Deliberately tight: a false positive silently withholds a card the user should have got, which is
    /// worse than letting a near-duplicate through. Paraphrases of one fact land around 0.05–0.10;
    /// two genuinely different facts about one topic rarely fall under 0.15.
    /// </summary>
    public double DuplicateDistance { get; set; } = 0.10;

    public bool IsConfigured => !string.IsNullOrWhiteSpace(ApiKey);
}
