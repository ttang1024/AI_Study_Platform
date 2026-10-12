using MediatR;
using StudyPlatform.Application.Common;
using StudyPlatform.Application.Videos.Commands;
using StudyPlatform.Application.Videos.DTOs;
using StudyPlatform.Domain.Interfaces;

namespace StudyPlatform.Application.Videos.Queries;

public record GetVideosQuery(
    Guid UserId,
    Guid? CourseId,
    string? Search,
    int Page,
    int PageSize) : IRequest<Result<VideoPagedResult>>, IPagedRequest;

public class GetVideosQueryHandler : IRequestHandler<GetVideosQuery, Result<VideoPagedResult>>
{
    private readonly ICourseRepository _courses;
    private readonly IVideoRepository _videos;
    private readonly ICourseAccess _courseAccess;

    public GetVideosQueryHandler(ICourseRepository courses, IVideoRepository videos, ICourseAccess courseAccess)
    {
        _courses = courses;
        _videos = videos;
        _courseAccess = courseAccess;
    }

    public async Task<Result<VideoPagedResult>> Handle(GetVideosQuery request, CancellationToken cancellationToken)
    {
        var queryUserId = request.UserId;
        var (page, pageSize) = Paging.Normalize(request.Page, request.PageSize);

        if (request.CourseId.HasValue)
        {
            var course = await _courses.GetByIdAsync(request.CourseId.Value, cancellationToken);
            if (course != null && course.UserId != request.UserId)
            {
                if (!await _courseAccess.HasSharedCourseAccessAsync(request.UserId, request.CourseId.Value, cancellationToken))
                    return Result<VideoPagedResult>.Success(
                        new VideoPagedResult([], 0, page, pageSize, 0));
                queryUserId = course.UserId;
            }
        }

        var (items, totalCount) = await _videos.GetPagedAsync(
            queryUserId, request.CourseId, request.Search,
            page, pageSize, cancellationToken);

        var totalPages = (int)Math.Ceiling(totalCount / (double)pageSize);
        var dtos = items.Select(SaveVideoCommandHandler.ToDto);

        return Result<VideoPagedResult>.Success(new VideoPagedResult(dtos, totalCount, page, pageSize, totalPages));
    }
}
