using MediatR;
using StudyPlatform.Application.Common;
using StudyPlatform.Application.YouTube.DTOs;
using StudyPlatform.Domain.Interfaces;

namespace StudyPlatform.Application.YouTube.Commands;

public record MoveYouTubeVideoCommand(Guid VideoId, Guid UserId, Guid TargetCourseId) : IRequest<Result<YouTubeVideoDto>>;

public class MoveYouTubeVideoCommandHandler : IRequestHandler<MoveYouTubeVideoCommand, Result<YouTubeVideoDto>>
{
    private readonly IUnitOfWork _unitOfWork;

    public MoveYouTubeVideoCommandHandler(IUnitOfWork unitOfWork) { _unitOfWork = unitOfWork; }

    public async Task<Result<YouTubeVideoDto>> Handle(MoveYouTubeVideoCommand request, CancellationToken cancellationToken)
    {
        var video = await _unitOfWork.YouTubeVideos.GetByIdForUserAsync(request.VideoId, request.UserId, cancellationToken);
        if (video is null) return Result<YouTubeVideoDto>.Failure("Video not found.", "VIDEO_NOT_FOUND");

        var courseExists = await _unitOfWork.Courses.BelongsToUserAsync(request.TargetCourseId, request.UserId, cancellationToken);
        if (!courseExists) return Result<YouTubeVideoDto>.Failure("Target course not found.", "COURSE_NOT_FOUND");

        video.CourseId = request.TargetCourseId;
        video.UpdatedAt = DateTime.UtcNow;

        await _unitOfWork.SaveChangesAsync(cancellationToken);

        var saved = await _unitOfWork.YouTubeVideos.GetByIdForUserAsync(video.YouTubeVideoId, request.UserId, cancellationToken);
        return Result<YouTubeVideoDto>.Success(SaveYouTubeVideoCommandHandler.ToDto(saved!));
    }
}
