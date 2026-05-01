using MediatR;
using StudyPlatform.Application.Common;
using StudyPlatform.Application.YouTube.Commands;
using StudyPlatform.Application.YouTube.DTOs;
using StudyPlatform.Domain.Interfaces;

namespace StudyPlatform.Application.YouTube.Queries;

public record GetYouTubeVideosQuery(
    Guid UserId,
    Guid? CourseId,
    string? Search,
    int Page,
    int PageSize) : IRequest<Result<YouTubeVideoPagedResult>>;

public class GetYouTubeVideosQueryHandler : IRequestHandler<GetYouTubeVideosQuery, Result<YouTubeVideoPagedResult>>
{
    private readonly IUnitOfWork _unitOfWork;

    public GetYouTubeVideosQueryHandler(IUnitOfWork unitOfWork)
    {
        _unitOfWork = unitOfWork;
    }

    public async Task<Result<YouTubeVideoPagedResult>> Handle(GetYouTubeVideosQuery request, CancellationToken cancellationToken)
    {
        var queryUserId = request.UserId;

        if (request.CourseId.HasValue)
        {
            var course = await _unitOfWork.Courses.GetByIdAsync(request.CourseId.Value, cancellationToken);
            if (course != null && course.UserId != request.UserId)
            {
                var shared = await _unitOfWork.StudyGroupSharedCourses.FindAsync(
                    sc => sc.CourseId == request.CourseId.Value, cancellationToken);
                var groupIds = shared.Select(sc => sc.GroupId).ToList();
                var hasGroupAccess = groupIds.Count > 0 && await _unitOfWork.StudyGroupMembers.ExistsAsync(
                    m => groupIds.Contains(m.GroupId) && m.UserId == request.UserId, cancellationToken);
                if (!hasGroupAccess)
                    return Result<YouTubeVideoPagedResult>.Success(
                        new YouTubeVideoPagedResult([], 0, request.Page, request.PageSize, 0));
                queryUserId = course.UserId;
            }
        }

        var (items, totalCount) = await _unitOfWork.YouTubeVideos.GetPagedAsync(
            queryUserId, request.CourseId, request.Search,
            request.Page, request.PageSize, cancellationToken);

        var totalPages = (int)Math.Ceiling(totalCount / (double)request.PageSize);
        var dtos = items.Select(SaveYouTubeVideoCommandHandler.ToDto);

        return Result<YouTubeVideoPagedResult>.Success(new YouTubeVideoPagedResult(dtos, totalCount, request.Page, request.PageSize, totalPages));
    }
}
