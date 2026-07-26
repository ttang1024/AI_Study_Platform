using Microsoft.Extensions.Logging;
using StudyPlatform.Application.Services;
using StudyPlatform.Domain.Entities;
using StudyPlatform.Domain.Interfaces;

namespace StudyPlatform.Infrastructure.Services;

public class DocumentTextProvider : IDocumentTextProvider
{
    private readonly IUnitOfWork _unitOfWork;
    private readonly ILogger<DocumentTextProvider> _logger;

    /// <summary>
    /// Resolved on demand rather than injected. The extractor's dependency chain reaches blob
    /// storage, whose constructor throws when storage is unconfigured or unreachable — eagerly
    /// injecting it would make a document that already has its text stored unreadable, which is
    /// exactly the case this class exists to serve cheaply.
    /// </summary>
    private readonly Func<IDocumentTextExtractor> _extractorFactory;

    public DocumentTextProvider(
        IUnitOfWork unitOfWork,
        Func<IDocumentTextExtractor> extractorFactory,
        ILogger<DocumentTextProvider> logger)
    {
        _unitOfWork = unitOfWork;
        _extractorFactory = extractorFactory;
        _logger = logger;
    }

    public async Task<string?> GetTextAsync(Document document, CancellationToken cancellationToken = default)
    {
        if (!string.IsNullOrEmpty(document.ExtractedText))
            return document.ExtractedText;

        // Audio carries its text as a transcript, produced by a separate pipeline.
        if (document.ContentType.StartsWith("audio/", StringComparison.OrdinalIgnoreCase))
            return string.IsNullOrEmpty(document.Transcript) ? null : document.Transcript;

        // Images have no text layer to extract — only an AI OCR call, which costs the user tokens.
        // Enabling a citation link is not a good enough reason to spend them behind their back.
        if (document.ContentType.StartsWith("image/", StringComparison.OrdinalIgnoreCase))
            return null;

        try
        {
            var text = await _extractorFactory()
                .ExtractTextAsync(document.BlobUrl, document.ContentType, cancellationToken);
            if (string.IsNullOrWhiteSpace(text))
                return null;

            document.ExtractedText = text;
            _unitOfWork.Documents.Update(document);
            await _unitOfWork.SaveChangesAsync(cancellationToken);

            return text;
        }
        catch (Exception ex)
        {
            // Degrade: a document whose text cannot be extracted simply gets no citations and no
            // source view. It must still summarize, quiz and generate flashcards as before.
            _logger.LogWarning(ex, "Could not extract text for document {DocumentId}", document.DocumentId);
            return null;
        }
    }
}
