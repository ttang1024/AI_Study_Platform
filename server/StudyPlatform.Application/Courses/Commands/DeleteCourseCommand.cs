using MediatR;
using StudyPlatform.Application.Common;
using StudyPlatform.Application.Services;
using StudyPlatform.Domain.Interfaces;

namespace StudyPlatform.Application.Courses.Commands;

public record DeleteCourseCommand(Guid CourseId, Guid UserId) : IRequest<Result>;

public class DeleteCourseCommandHandler : IRequestHandler<DeleteCourseCommand, Result>
{
    private readonly IUnitOfWork _unitOfWork;
    private readonly IBlobStorageService _blobStorageService;

    public DeleteCourseCommandHandler(IUnitOfWork unitOfWork, IBlobStorageService blobStorageService)
    {
        _unitOfWork = unitOfWork;
        _blobStorageService = blobStorageService;
    }

    public async Task<Result> Handle(DeleteCourseCommand request, CancellationToken cancellationToken)
    {
        var course = await _unitOfWork.Courses.GetByIdWithDocumentsAsync(request.CourseId, cancellationToken);
        if (course == null || course.UserId != request.UserId)
            return Result.Failure("Course not found.", "COURSE_NOT_FOUND");

        foreach (var document in course.Documents)
        {
            try
            {
                await _blobStorageService.DeleteAsync(document.BlobUrl, cancellationToken);
            }
            catch
            {
                // Continue even if blob deletion fails
            }
        }

        _unitOfWork.Courses.Remove(course);
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        return Result.Success("Course deleted successfully.");
    }
}
