using Pgvector;

namespace StudyPlatform.Domain.Entities;

/// <summary>
/// One embedded chunk of a user's study material. Sources are chunked rather than embedded whole:
/// a single vector for a 40-page document averages out to nothing in particular, and retrieval needs
/// to hand the model the passage that answers the question, not the whole file.
/// </summary>
public class ContentEmbedding
{
    public Guid ContentEmbeddingId { get; set; }
    public Guid UserId { get; set; }

    /// <summary>"document", "video", "note" or "glossary" — matches the search result types.</summary>
    public string SourceType { get; set; } = string.Empty;

    public Guid SourceId { get; set; }
    public string Title { get; set; } = string.Empty;

    /// <summary>Position of this chunk within the source, for ordering and de-duplication.</summary>
    public int ChunkIndex { get; set; }

    /// <summary>The chunk's text, kept so retrieval can hand the excerpt straight to the model.</summary>
    public string Text { get; set; } = string.Empty;

    public Vector Embedding { get; set; } = null!;

    /// <summary>Hash of the source's full text at index time. The backfill worker re-indexes when it changes.</summary>
    public string SourceHash { get; set; } = string.Empty;

    /// <summary>Embedding model used. Vectors from different models aren't comparable, so a model change forces a re-index.</summary>
    public string Model { get; set; } = string.Empty;

    public DateTime CreatedAt { get; set; }

    public User User { get; set; } = null!;
}
