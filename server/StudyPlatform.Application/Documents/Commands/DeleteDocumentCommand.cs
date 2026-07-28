using MediatR;
using StudyPlatform.Application.Common;
using StudyPlatform.Application.Services;
using StudyPlatform.Domain.Interfaces;

namespace StudyPlatform.Application.Documents.Commands;

public record DeleteDocumentCommand(Guid DocumentId, Guid UserId) : IRequest<Result>;

public class DeleteDocumentCommandHandler : IRequestHandler<DeleteDocumentCommand, Result>
{
    private readonly IUnitOfWork _unitOfWork;
    private readonly IBlobStorageService _blobStorageService;
    private readonly IEmbeddingIndex _embeddingIndex;

    public DeleteDocumentCommandHandler(
        IUnitOfWork unitOfWork,
        IBlobStorageService blobStorageService,
        IEmbeddingIndex embeddingIndex)
    {
        _unitOfWork = unitOfWork;
        _blobStorageService = blobStorageService;
        _embeddingIndex = embeddingIndex;
    }

    public async Task<Result> Handle(DeleteDocumentCommand request, CancellationToken cancellationToken)
    {
        var document = await _unitOfWork.Documents.GetByIdAsync(request.DocumentId, cancellationToken);
        if (document == null || document.UserId != request.UserId)
            return Result.Failure("Document not found.", "DOCUMENT_NOT_FOUND");

        try
        {
            await _blobStorageService.DeleteAsync(document.BlobUrl, cancellationToken);
        }
        catch
        {
            // Continue even if blob deletion fails
        }

        _unitOfWork.Documents.Remove(document);
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        // After the save, so the cascade has taken the document's flashcards and glossary terms with it
        // and their chunks look orphaned too.
        await _embeddingIndex.PruneOrphansAsync(request.UserId, cancellationToken);

        return Result.Success("Document deleted successfully.");
    }
}
