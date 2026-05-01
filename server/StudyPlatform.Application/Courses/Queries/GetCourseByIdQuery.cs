using MediatR;
using StudyPlatform.Application.Common;
using StudyPlatform.Application.Courses.DTOs;
using StudyPlatform.Domain.Interfaces;

namespace StudyPlatform.Application.Courses.Queries;

public record GetCourseByIdQuery(Guid CourseId, Guid UserId) : IRequest<Result<CourseDto>>;

public class GetCourseByIdQueryHandler : IRequestHandler<GetCourseByIdQuery, Result<CourseDto>>
{
    private readonly IUnitOfWork _unitOfWork;

    public GetCourseByIdQueryHandler(IUnitOfWork unitOfWork)
    {
        _unitOfWork = unitOfWork;
    }

    public async Task<Result<CourseDto>> Handle(GetCourseByIdQuery request, CancellationToken cancellationToken)
    {
        var course = await _unitOfWork.Courses.GetByIdWithDocumentsAsync(request.CourseId, cancellationToken);
        if (course == null)
            return Result<CourseDto>.Failure("Course not found.", "COURSE_NOT_FOUND");

        if (course.UserId != request.UserId)
        {
            var shared = await _unitOfWork.StudyGroupSharedCourses.FindAsync(sc => sc.CourseId == request.CourseId, cancellationToken);
            var groupIds = shared.Select(sc => sc.GroupId).ToList();
            var hasGroupAccess = groupIds.Count > 0 && await _unitOfWork.StudyGroupMembers.ExistsAsync(
                m => groupIds.Contains(m.GroupId) && m.UserId == request.UserId, cancellationToken);
            if (!hasGroupAccess)
                return Result<CourseDto>.Failure("Course not found.", "COURSE_NOT_FOUND");
        }

        var dto = new CourseDto(
            course.CourseId,
            course.UserId,
            course.CourseName,
            course.CourseColor,
            course.Documents?.Count ?? 0,
            course.CreatedAt,
            course.UpdatedAt);

        return Result<CourseDto>.Success(dto);
    }
}
