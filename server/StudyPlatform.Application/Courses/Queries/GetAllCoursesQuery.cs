using MediatR;
using StudyPlatform.Application.Common;
using StudyPlatform.Application.Courses.DTOs;
using StudyPlatform.Domain.Interfaces;

namespace StudyPlatform.Application.Courses.Queries;

public record GetAllCoursesQuery(Guid UserId) : IRequest<Result<IEnumerable<CourseDto>>>;

public class GetAllCoursesQueryHandler : IRequestHandler<GetAllCoursesQuery, Result<IEnumerable<CourseDto>>>
{
    private readonly IUnitOfWork _unitOfWork;

    public GetAllCoursesQueryHandler(IUnitOfWork unitOfWork)
    {
        _unitOfWork = unitOfWork;
    }

    public async Task<Result<IEnumerable<CourseDto>>> Handle(GetAllCoursesQuery request, CancellationToken cancellationToken)
    {
        var courses = await _unitOfWork.Courses.GetListItemsByUserAsync(request.UserId, cancellationToken);

        var dtos = courses.Select(c => new CourseDto(
            c.CourseId,
            c.UserId,
            c.CourseName,
            c.CourseColor,
            c.DocumentCount,
            c.CreatedAt,
            c.UpdatedAt));

        return Result<IEnumerable<CourseDto>>.Success(dtos);
    }
}
