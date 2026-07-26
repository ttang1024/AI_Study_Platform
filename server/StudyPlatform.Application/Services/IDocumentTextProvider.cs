using StudyPlatform.Domain.Entities;

namespace StudyPlatform.Application.Services;

/// <summary>
/// The single source of a document's plain text.
///
/// <para>Exists because two features must agree on one exact string: citation anchors store
/// character offsets into it, and the source view renders it. If either re-derived the text
/// independently they would disagree — the PDF and image extractors fall back to AI transcription,
/// which is not reproducible — and every citation would land in the wrong place with no error to
/// notice.</para>
///
/// <para>So the text is extracted at most once and persisted on the document. Callers get the
/// stored copy from then on, which also removes a blob download and a re-parse from every
/// generation request.</para>
/// </summary>
public interface IDocumentTextProvider
{
    /// <summary>
    /// The document's plain text, extracting and persisting it if this is the first request.
    /// Null when the document has no meaningful text layer (an image, or audio not yet transcribed).
    /// </summary>
    Task<string?> GetTextAsync(Document document, CancellationToken cancellationToken = default);
}
