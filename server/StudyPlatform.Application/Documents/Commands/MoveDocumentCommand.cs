using MediatR;
using StudyPlatform.Application.Common;
using StudyPlatform.Application.Documents.DTOs;
using StudyPlatform.Domain.Interfaces;

namespace StudyPlatform.Application.Documents.Commands;

public record MoveDocumentCommand(Guid DocumentId, Guid UserId, Guid TargetCourseId) : IRequest<Result<DocumentDto>>;

public class MoveDocumentCommandHandler : IRequestHandler<MoveDocumentCommand, Result<DocumentDto>>
{
    private readonly IUnitOfWork _unitOfWork;
    private readonly ICourseRepository _courses;
    private readonly IDocumentRepository _documents;

    public MoveDocumentCommandHandler(IUnitOfWork unitOfWork, ICourseRepository courses, IDocumentRepository documents) { _unitOfWork = unitOfWork;
    _courses = courses;
    _documents = documents; }

    public async Task<Result<DocumentDto>> Handle(MoveDocumentCommand request, CancellationToken cancellationToken)
    {
        var document = await _documents.GetOwnedAsync(request.DocumentId, request.UserId, cancellationToken);
        if (document == null)
            return Result<DocumentDto>.Failure("Document not found.", "DOCUMENT_NOT_FOUND");

        var courseExists = await _courses.BelongsToUserAsync(request.TargetCourseId, request.UserId, cancellationToken);
        if (!courseExists)
            return Result<DocumentDto>.Failure("Target course not found.", "COURSE_NOT_FOUND");

        document.CourseId = request.TargetCourseId;
        document.UpdatedAt = DateTime.UtcNow;

        await _unitOfWork.SaveChangesAsync(cancellationToken);

        return Result<DocumentDto>.Success(document.ToDocumentDto());
    }
}
