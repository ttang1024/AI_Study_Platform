using MediatR;
using StudyPlatform.Application.Common;
using StudyPlatform.Application.Courses.DTOs;
using StudyPlatform.Domain.Entities;
using StudyPlatform.Domain.Interfaces;

namespace StudyPlatform.Application.Courses.Commands;

public record CreateCourseCommand(
    Guid UserId,
    string CourseName,
    string CourseColor) : IRequest<Result<CourseDto>>;

public class CreateCourseCommandHandler : IRequestHandler<CreateCourseCommand, Result<CourseDto>>
{
    private readonly IUnitOfWork _unitOfWork;

    public CreateCourseCommandHandler(IUnitOfWork unitOfWork)
    {
        _unitOfWork = unitOfWork;
    }

    public async Task<Result<CourseDto>> Handle(CreateCourseCommand request, CancellationToken cancellationToken)
    {
        var course = new Course
        {
            CourseId = Guid.NewGuid(),
            UserId = request.UserId,
            CourseName = request.CourseName,
            CourseColor = request.CourseColor,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        await _unitOfWork.Courses.AddAsync(course, cancellationToken);
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        var dto = new CourseDto(
            course.CourseId,
            course.UserId,
            course.CourseName,
            course.CourseColor,
            0,
            course.CreatedAt,
            course.UpdatedAt);

        return Result<CourseDto>.Success(dto, "Course created successfully.");
    }
}
