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
    private readonly ICourseRepository _courses;
    private readonly IDocumentRepository _documents;

    public UpdateCourseCommandHandler(IUnitOfWork unitOfWork, ICourseRepository courses, IDocumentRepository documents)
    {
        _unitOfWork = unitOfWork;
        _courses = courses;
        _documents = documents;
    }

    public async Task<Result<CourseDto>> Handle(UpdateCourseCommand request, CancellationToken cancellationToken)
    {
        var course = await _courses.GetOwnedAsync(request.CourseId, request.UserId, cancellationToken);
        if (course == null)
            return Result<CourseDto>.Failure("Course not found.", "COURSE_NOT_FOUND");

        // A COUNT for the response DTO, rather than loading every document (and its text) to call .Count.
        var documentCount = await _documents.CountAsync(d => d.CourseId == request.CourseId, cancellationToken);

        course.CourseName = request.CourseName;
        course.CourseColor = request.CourseColor;
        course.UpdatedAt = DateTime.UtcNow;

        _courses.Update(course);
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        var dto = new CourseDto(
            course.CourseId,
            course.UserId,
            course.CourseName,
            course.CourseColor,
            documentCount,
            course.CreatedAt,
            course.UpdatedAt);

        return Result<CourseDto>.Success(dto, "Course updated successfully.");
    }
}
