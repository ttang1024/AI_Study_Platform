using System.Security.Cryptography;
using MediatR;
using Microsoft.Extensions.Logging;
using StudyPlatform.Application.Common;
using StudyPlatform.Application.Services;
using StudyPlatform.Domain.Interfaces;

namespace StudyPlatform.Application.Documents.Commands;

/// <summary>
/// How much of a document's generated material the source change has invalidated.
/// </summary>
public record StalenessDto(
    Guid DocumentId,
    int ContentVersion,
    DateTime? SourceChangedAt,
    int StaleFlashcards,
    int StaleQuizzes,
    int StaleGlossaryTerms,
    bool SummaryStale,
    bool MindMapStale)
{
    public bool HasStaleArtifacts =>
        StaleFlashcards > 0 || StaleQuizzes > 0 || StaleGlossaryTerms > 0 || SummaryStale || MindMapStale;
}

public record GetDocumentStalenessQuery(Guid UserId, Guid DocumentId) : IRequest<Result<StalenessDto>>;

public class GetDocumentStalenessQueryHandler : IRequestHandler<GetDocumentStalenessQuery, Result<StalenessDto>>
{
    private readonly IUnitOfWork _unitOfWork;
    public GetDocumentStalenessQueryHandler(IUnitOfWork unitOfWork) { _unitOfWork = unitOfWork; }

    public async Task<Result<StalenessDto>> Handle(
        GetDocumentStalenessQuery request, CancellationToken cancellationToken)
    {
        var document = await _unitOfWork.Documents.GetByIdAsync(request.DocumentId, cancellationToken);
        if (document == null || document.UserId != request.UserId)
            return Result<StalenessDto>.Failure("Document not found.", "DOCUMENT_NOT_FOUND");

        var version = document.ContentVersion;

        var flashcards = await _unitOfWork.Flashcards.CountAsync(
            f => f.DocumentId == request.DocumentId && f.SourceVersion < version, cancellationToken);
        var quizzes = await _unitOfWork.Quizzes.CountAsync(
            q => q.DocumentId == request.DocumentId && q.SourceVersion < version, cancellationToken);
        var glossary = await _unitOfWork.GlossaryTerms.CountAsync(
            t => t.DocumentId == request.DocumentId && t.SourceVersion < version, cancellationToken);

        // Summary and mind map live on the document itself, so they carry their own version stamps
        // and are compared exactly like the artifact rows above. Regenerating either re-stamps it and
        // drops it out of this list, which is what makes the banner dismissible by acting on it.
        return Result<StalenessDto>.Success(new StalenessDto(
            document.DocumentId,
            version,
            document.SourceChangedAt,
            flashcards,
            quizzes,
            glossary,
            SummaryStale: !string.IsNullOrWhiteSpace(document.Summary) && document.SummaryVersion < version,
            MindMapStale: !string.IsNullOrWhiteSpace(document.MindMapText) && document.MindMapVersion < version));
    }
}

/// <summary>
/// Replaces a document's underlying file with a revised version.
///
/// Nothing is deleted here. The version bump alone makes the existing artifacts read as stale, so
/// the learner keeps studying their cards — including their FSRS history — until they choose to
/// regenerate. Silently discarding a deck because someone re-uploaded a corrected PDF would throw
/// away months of review scheduling.
/// </summary>
public record ReplaceDocumentSourceCommand(
    Guid UserId,
    Guid DocumentId,
    Stream FileStream,
    string FileName,
    string ContentType,
    long FileSize) : IRequest<Result<StalenessDto>>;

public class ReplaceDocumentSourceCommandHandler
    : IRequestHandler<ReplaceDocumentSourceCommand, Result<StalenessDto>>
{
    private readonly IUnitOfWork _unitOfWork;
    private readonly IBlobStorageService _blobStorage;
    private readonly IMediator _mediator;
    private readonly ILogger<ReplaceDocumentSourceCommandHandler> _logger;

    public ReplaceDocumentSourceCommandHandler(
        IUnitOfWork unitOfWork,
        IBlobStorageService blobStorage,
        IMediator mediator,
        ILogger<ReplaceDocumentSourceCommandHandler> logger)
    {
        _unitOfWork = unitOfWork;
        _blobStorage = blobStorage;
        _mediator = mediator;
        _logger = logger;
    }

    public async Task<Result<StalenessDto>> Handle(
        ReplaceDocumentSourceCommand request, CancellationToken cancellationToken)
    {
        var document = await _unitOfWork.Documents.GetByIdAsync(request.DocumentId, cancellationToken);
        if (document == null || document.UserId != request.UserId)
            return Result<StalenessDto>.Failure("Document not found.", "DOCUMENT_NOT_FOUND");

        await using var buffer = new MemoryStream();
        await request.FileStream.CopyToAsync(buffer, cancellationToken);
        buffer.Position = 0;

        var hash = Convert.ToHexStringLower(await SHA256.HashDataAsync(buffer, cancellationToken));
        buffer.Position = 0;

        // Re-uploading a byte-identical file is a no-op, not a version bump: bumping would mark every
        // artifact stale and prompt the user to regenerate material that is in fact still correct.
        if (string.Equals(hash, document.FileHash, StringComparison.OrdinalIgnoreCase))
        {
            var unchanged = await _mediator.Send(
                new GetDocumentStalenessQuery(request.UserId, request.DocumentId), cancellationToken);

            return unchanged.IsSuccess
                ? Result<StalenessDto>.Success(unchanged.Data!, "That file is identical to the current version.")
                : unchanged;
        }

        var blobFileName = $"{request.UserId}/{document.CourseId}/{Guid.NewGuid()}_{request.FileName}";
        string blobUrl;
        try
        {
            blobUrl = await _blobStorage.UploadAsync(buffer, blobFileName, request.ContentType, cancellationToken);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to upload replacement blob for document {DocumentId}", request.DocumentId);
            return Result<StalenessDto>.Failure("Storage unavailable. Please try again later.", "STORAGE_ERROR");
        }

        var previousBlobUrl = document.BlobUrl;

        document.FileName = request.FileName;
        document.BlobUrl = blobUrl;
        document.ContentType = request.ContentType;
        document.FileSize = request.FileSize;
        document.FileHash = hash;
        document.ContentVersion += 1;
        document.SourceChangedAt = DateTime.UtcNow;
        document.UpdatedAt = DateTime.UtcNow;

        // Both belonged to the old file. Leaving either would have the source view rendering the
        // previous document while citations claim to point into it.
        document.Transcript = null;
        document.ExtractedText = null;

        _unitOfWork.Documents.Update(document);
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        // Best-effort cleanup, after the row is committed: an orphaned blob costs storage, but
        // deleting the old blob before the new one is durably referenced could lose both.
        try
        {
            await _blobStorage.DeleteAsync(previousBlobUrl, cancellationToken);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Could not remove the superseded blob for document {DocumentId}", request.DocumentId);
        }

        var staleness = await _mediator.Send(
            new GetDocumentStalenessQuery(request.UserId, request.DocumentId), cancellationToken);

        return staleness.IsSuccess
            ? Result<StalenessDto>.Success(staleness.Data!, "Source replaced. Generated material is now out of date.")
            : staleness;
    }
}

/// <summary>
/// Drops the stale artifacts of the requested kinds so the ordinary generate endpoints rebuild them
/// on next request — those already return cached rows when any exist, so clearing is the whole job.
/// </summary>
public record RegenerateStaleArtifactsCommand(
    Guid UserId,
    Guid DocumentId,
    bool Flashcards,
    bool Quizzes,
    bool Glossary) : IRequest<Result<StalenessDto>>;

public class RegenerateStaleArtifactsCommandHandler
    : IRequestHandler<RegenerateStaleArtifactsCommand, Result<StalenessDto>>
{
    private readonly IUnitOfWork _unitOfWork;
    private readonly IMediator _mediator;

    public RegenerateStaleArtifactsCommandHandler(IUnitOfWork unitOfWork, IMediator mediator)
    {
        _unitOfWork = unitOfWork;
        _mediator = mediator;
    }

    public async Task<Result<StalenessDto>> Handle(
        RegenerateStaleArtifactsCommand request, CancellationToken cancellationToken)
    {
        var document = await _unitOfWork.Documents.GetByIdAsync(request.DocumentId, cancellationToken);
        if (document == null || document.UserId != request.UserId)
            return Result<StalenessDto>.Failure("Document not found.", "DOCUMENT_NOT_FOUND");

        var version = document.ContentVersion;

        if (request.Flashcards)
        {
            var stale = await _unitOfWork.Flashcards.FindAsync(
                f => f.DocumentId == request.DocumentId && f.SourceVersion < version, cancellationToken);
            _unitOfWork.Flashcards.RemoveRange(stale);
        }

        if (request.Quizzes)
        {
            var stale = await _unitOfWork.Quizzes.FindAsync(
                q => q.DocumentId == request.DocumentId && q.SourceVersion < version, cancellationToken);
            _unitOfWork.Quizzes.RemoveRange(stale);
        }

        if (request.Glossary)
        {
            var stale = await _unitOfWork.GlossaryTerms.FindAsync(
                t => t.DocumentId == request.DocumentId && t.SourceVersion < version, cancellationToken);
            _unitOfWork.GlossaryTerms.RemoveRange(stale);
        }

        await _unitOfWork.SaveChangesAsync(cancellationToken);

        return await _mediator.Send(new GetDocumentStalenessQuery(request.UserId, request.DocumentId), cancellationToken);
    }
}
