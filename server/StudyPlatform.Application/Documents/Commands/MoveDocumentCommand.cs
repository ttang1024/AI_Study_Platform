using MediatR;
using StudyPlatform.Application.Common;
using StudyPlatform.Application.Documents.DTOs;
using StudyPlatform.Domain.Interfaces;

namespace StudyPlatform.Application.Documents.Commands;

public record MoveDocumentCommand(Guid DocumentId, Guid UserId, Guid TargetCourseId) : IRequest<Result<DocumentDto>>;

public class MoveDocumentCommandHandler : IRequestHandler<MoveDocumentCommand, Result<DocumentDto>>
{
    private readonly IUnitOfWork _unitOfWork;

    public MoveDocumentCommandHandler(IUnitOfWork unitOfWork) { _unitOfWork = unitOfWork; }

    public async Task<Result<DocumentDto>> Handle(MoveDocumentCommand request, CancellationToken cancellationToken)
    {
        var document = await _unitOfWork.Documents.GetByIdAsync(request.DocumentId, cancellationToken);
        if (document == null || document.UserId != request.UserId)
            return Result<DocumentDto>.Failure("Document not found.", "DOCUMENT_NOT_FOUND");

        var courseExists = await _unitOfWork.Courses.BelongsToUserAsync(request.TargetCourseId, request.UserId, cancellationToken);
        if (!courseExists)
            return Result<DocumentDto>.Failure("Target course not found.", "COURSE_NOT_FOUND");

        document.CourseId = request.TargetCourseId;
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
            document.Transcript));
    }
}
