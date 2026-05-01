using MediatR;
using StudyPlatform.Application.Common;
using StudyPlatform.Application.YouTube.Commands;
using StudyPlatform.Application.YouTube.DTOs;
using StudyPlatform.Domain.Interfaces;

namespace StudyPlatform.Application.YouTube.Queries;

public record GetYouTubeVideoByIdQuery(Guid Id, Guid UserId) : IRequest<Result<YouTubeVideoDto>>;

public class GetYouTubeVideoByIdQueryHandler : IRequestHandler<GetYouTubeVideoByIdQuery, Result<YouTubeVideoDto>>
{
    private readonly IUnitOfWork _unitOfWork;

    public GetYouTubeVideoByIdQueryHandler(IUnitOfWork unitOfWork)
    {
        _unitOfWork = unitOfWork;
    }

    public async Task<Result<YouTubeVideoDto>> Handle(GetYouTubeVideoByIdQuery request, CancellationToken cancellationToken)
    {
        var video = await _unitOfWork.YouTubeVideos.GetByIdForUserAsync(request.Id, request.UserId, cancellationToken);

        if (video is null)
        {
            // Check if the video belongs to a course shared with one of the user's study groups
            video = await _unitOfWork.YouTubeVideos.GetByIdWithCourseAsync(request.Id, cancellationToken);
            if (video is null)
                return Result<YouTubeVideoDto>.Failure("Video not found.", "NOT_FOUND");

            var shared = await _unitOfWork.StudyGroupSharedCourses.FindAsync(sc => sc.CourseId == video.CourseId, cancellationToken);
            var groupIds = shared.Select(sc => sc.GroupId).ToList();
            var hasGroupAccess = groupIds.Count > 0 && await _unitOfWork.StudyGroupMembers.ExistsAsync(
                m => groupIds.Contains(m.GroupId) && m.UserId == request.UserId, cancellationToken);
            if (!hasGroupAccess)
                return Result<YouTubeVideoDto>.Failure("Video not found.", "NOT_FOUND");
        }

        return Result<YouTubeVideoDto>.Success(SaveYouTubeVideoCommandHandler.ToDto(video));
    }
}
