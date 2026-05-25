using MediatR;
using StudyPlatform.Application.Common;
using StudyPlatform.Application.Documents.DTOs;
using StudyPlatform.Domain.Interfaces;

namespace StudyPlatform.Application.Documents.Commands;

public record UpdateDocumentCommand(Guid DocumentId, Guid UserId, string FileName) : IRequest<Result<DocumentDto>>;

public class UpdateDocumentCommandHandler : IRequestHandler<UpdateDocumentCommand, Result<DocumentDto>>
{
    private readonly IUnitOfWork _unitOfWork;

    public UpdateDocumentCommandHandler(IUnitOfWork unitOfWork) { _unitOfWork = unitOfWork; }

    public async Task<Result<DocumentDto>> Handle(UpdateDocumentCommand request, CancellationToken cancellationToken)
    {
        var document = await _unitOfWork.Documents.GetByIdAsync(request.DocumentId, cancellationToken);
        if (document == null || document.UserId != request.UserId)
            return Result<DocumentDto>.Failure("Document not found.", "DOCUMENT_NOT_FOUND");

        var fileName = request.FileName.Trim();
        if (string.IsNullOrWhiteSpace(fileName))
            return Result<DocumentDto>.Failure("File name is required.", "INVALID_FILE_NAME");

        if (fileName.Length > 500)
            return Result<DocumentDto>.Failure("File name must be 500 characters or fewer.", "INVALID_FILE_NAME");

        document.FileName = fileName;
        document.UpdatedAt = DateTime.UtcNow;

        await _unitOfWork.SaveChangesAsync(cancellationToken);

        return Result<DocumentDto>.Success(new DocumentDto(
            document.DocumentId,
            document.CourseId,
            document.UserId,
            document.FileName,
            document.BlobUrl,
            document.ContentType,
            document.FileSize,
            document.FileHash,
            document.Summary,
            document.MindMapText,
            document.CreatedAt,
            document.UpdatedAt,
            document.Transcript,
            document.OriginalUrl));
    }
}
