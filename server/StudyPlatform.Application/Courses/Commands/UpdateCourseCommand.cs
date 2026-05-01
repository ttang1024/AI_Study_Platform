using MediatR;
using StudyPlatform.Application.Common;
using StudyPlatform.Application.Courses.DTOs;
using StudyPlatform.Domain.Interfaces;

namespace StudyPlatform.Application.Courses.Commands;

public record UpdateCourseCommand(
    Guid CourseId,
    Guid UserId,
    string CourseName,
    string CourseColor) : IRequest<Result<CourseDto>>;

public class UpdateCourseCommandHandler : IRequestHandler<UpdateCourseCommand, Result<CourseDto>>
{
    private readonly IUnitOfWork _unitOfWork;

    public UpdateCourseCommandHandler(IUnitOfWork unitOfWork)
    {
        _unitOfWork = unitOfWork;
    }

    public async Task<Result<CourseDto>> Handle(UpdateCourseCommand request, CancellationToken cancellationToken)
    {
        var course = await _unitOfWork.Courses.GetByIdWithDocumentsAsync(request.CourseId, cancellationToken);
        if (course == null || course.UserId != request.UserId)
            return Result<CourseDto>.Failure("Course not found.", "COURSE_NOT_FOUND");

        course.CourseName = request.CourseName;
        course.CourseColor = request.CourseColor;
        course.UpdatedAt = DateTime.UtcNow;

        _unitOfWork.Courses.Update(course);
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        var dto = new CourseDto(
            course.CourseId,
            course.UserId,
            course.CourseName,
            course.CourseColor,
            course.Documents.Count,
            course.CreatedAt,
            course.UpdatedAt);

        return Result<CourseDto>.Success(dto, "Course updated successfully.");
    }
}
