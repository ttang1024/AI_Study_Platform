using StudyPlatform.Domain.Interfaces;

namespace StudyPlatform.Domain.Entities;

public class Document : IUserOwned
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

    /// <summary>
    /// Set when a transcription is queued, cleared when it finishes or fails. The queue itself is
    /// in-memory, so this is what lets a restarted API (every deploy) pick unfinished jobs back up
    /// instead of leaving the document waiting forever.
    /// </summary>
    public DateTime? TranscriptionRequestedAt { get; set; }
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
    /// documents uploaded before this existed.</para>
    /// </summary>
    public string? ExtractedText { get; set; }

    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
    public Course Course { get; set; } = null!;
    public User User { get; set; } = null!;
    public ICollection<Note> Notes { get; set; } = new List<Note>();
    public ICollection<Quiz> Quizzes { get; set; } = new List<Quiz>();
    public ICollection<Flashcard> Flashcards { get; set; } = new List<Flashcard>();
    public ICollection<ChatMessage> ChatMessages { get; set; } = new List<ChatMessage>();
}
