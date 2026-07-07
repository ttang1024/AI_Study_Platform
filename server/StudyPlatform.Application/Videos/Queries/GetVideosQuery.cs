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
    int PageSize) : IRequest<Result<VideoPagedResult>>;

public class GetVideosQueryHandler : IRequestHandler<GetVideosQuery, Result<VideoPagedResult>>
{
    private readonly IUnitOfWork _unitOfWork;

    public GetVideosQueryHandler(IUnitOfWork unitOfWork)
    {
        _unitOfWork = unitOfWork;
    }

    public async Task<Result<VideoPagedResult>> Handle(GetVideosQuery request, CancellationToken cancellationToken)
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
                    return Result<VideoPagedResult>.Success(
                        new VideoPagedResult([], 0, request.Page, request.PageSize, 0));
                queryUserId = course.UserId;
            }
        }

        var (items, totalCount) = await _unitOfWork.Videos.GetPagedAsync(
            queryUserId, request.CourseId, request.Search,
            request.Page, request.PageSize, cancellationToken);

        var totalPages = (int)Math.Ceiling(totalCount / (double)request.PageSize);
        var dtos = items.Select(SaveVideoCommandHandler.ToDto);

        return Result<VideoPagedResult>.Success(new VideoPagedResult(dtos, totalCount, request.Page, request.PageSize, totalPages));
    }
}
