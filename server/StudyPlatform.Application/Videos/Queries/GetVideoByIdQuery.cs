using MediatR;
using StudyPlatform.Application.Common;
using StudyPlatform.Application.Videos.Commands;
using StudyPlatform.Application.Videos.DTOs;
using StudyPlatform.Domain.Interfaces;

namespace StudyPlatform.Application.Videos.Queries;

public record GetVideoByIdQuery(Guid Id, Guid UserId) : IRequest<Result<VideoDto>>;

public class GetVideoByIdQueryHandler : IRequestHandler<GetVideoByIdQuery, Result<VideoDto>>
{
    private readonly IVideoRepository _videos;
    private readonly ICourseAccess _courseAccess;

    public GetVideoByIdQueryHandler(IVideoRepository videos, ICourseAccess courseAccess)
    {
        _videos = videos;
        _courseAccess = courseAccess;
    }

    public async Task<Result<VideoDto>> Handle(GetVideoByIdQuery request, CancellationToken cancellationToken)
    {
        var video = await _videos.GetByIdForUserAsync(request.Id, request.UserId, cancellationToken);

        if (video is null)
        {
            // Check if the video belongs to a course shared with one of the user's study groups
            video = await _videos.GetByIdWithCourseAsync(request.Id, cancellationToken);
            if (video is null)
                return Result<VideoDto>.Failure("Video not found.", "NOT_FOUND");

            if (!await _courseAccess.HasSharedCourseAccessAsync(request.UserId, video.CourseId, cancellationToken))
                return Result<VideoDto>.Failure("Video not found.", "NOT_FOUND");
        }

        return Result<VideoDto>.Success(SaveVideoCommandHandler.ToDto(video));
    }
}
