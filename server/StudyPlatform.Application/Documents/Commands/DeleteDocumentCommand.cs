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

    public DeleteDocumentCommandHandler(IUnitOfWork unitOfWork, IBlobStorageService blobStorageService)
    {
        _unitOfWork = unitOfWork;
        _blobStorageService = blobStorageService;
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

        return Result.Success("Document deleted successfully.");
    }
}
