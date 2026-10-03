namespace StudyPlatform.Domain.Entities;

public class Document
{
    public Guid DocumentId { get; set; }
    public Guid CourseId { get; set; }
    public Guid UserId { get; set; }
    public string FileName { get; set; } = string.Empty;
    public string BlobUrl { get; set; } = string.Empty;
    public string ContentType { get; set; } = string.Empty;
    public long FileSize { get; set; }
    public string? FileHash { get; set; }
    public string? Summary { get; set; }
    public string? MindMapText { get; set; }
    public string? Transcript { get; set; }
    public string? OriginalUrl { get; set; }

    /// <summary>
    /// The canonical plain text of this document, extracted once and kept.
    ///
    /// <para>Two things depend on it being stable rather than re-derived. Citation offsets index
    /// into this exact string, and extraction is not deterministic — the PDF and image paths fall
    /// back to an AI transcription, so re-extracting would silently move every anchor. It is also
    /// what the source view renders, so what a citation points at is what the reader sees.</para>
    ///
    /// <para>Null for images (extracting would mean a paid OCR call just to enable a link) and for
    /// documents uploaded before this existed. Cleared when the source file is replaced.</para>
    /// </summary>
    public string? ExtractedText { get; set; }

    /// <summary>
    /// Bumped every time the underlying file is replaced. Generated artifacts record the version
    /// they were built from, so "is this flashcard out of date?" is a comparison rather than a flag
    /// somebody has to remember to set on every write path.
    /// </summary>
    public int ContentVersion { get; set; } = 1;

    /// <summary>When the source file was last replaced. Null for documents never re-uploaded.</summary>
    public DateTime? SourceChangedAt { get; set; }

    /// <summary>
    /// The ContentVersion the summary and mind map were generated from.
    ///
    /// <para>These live on the document rather than in rows of their own, so they need their own
    /// stamps to answer "is this out of date?". Deriving it from SourceChangedAt instead would make
    /// the answer permanently yes: the timestamp never clears, so a regenerated summary would go on
    /// reporting itself stale forever, with no action the reader could take to silence it.</para>
    ///
    /// <para>Default 1 matches ContentVersion's default, so material written before versioning
    /// existed reads as current rather than as universally stale.</para>
    /// </summary>
    public int SummaryVersion { get; set; } = 1;

    /// <inheritdoc cref="SummaryVersion"/>
    public int MindMapVersion { get; set; } = 1;

    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
    public Course Course { get; set; } = null!;
    public User User { get; set; } = null!;
    public ICollection<Note> Notes { get; set; } = new List<Note>();
    public ICollection<Quiz> Quizzes { get; set; } = new List<Quiz>();
    public ICollection<Flashcard> Flashcards { get; set; } = new List<Flashcard>();
    public ICollection<ChatMessage> ChatMessages { get; set; } = new List<ChatMessage>();
}
