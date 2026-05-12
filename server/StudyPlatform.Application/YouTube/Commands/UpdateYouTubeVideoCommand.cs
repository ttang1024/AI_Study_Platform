using MediatR;
using StudyPlatform.Application.Common;
using StudyPlatform.Application.YouTube.DTOs;
using StudyPlatform.Domain.Interfaces;

namespace StudyPlatform.Application.YouTube.Commands;

public record UpdateYouTubeVideoCommand(
    Guid VideoId,
    Guid UserId,
    string? Title,
    string? Summary,
    string? MindMapText) : IRequest<Result<YouTubeVideoDto>>;

public class UpdateYouTubeVideoCommandHandler : IRequestHandler<UpdateYouTubeVideoCommand, Result<YouTubeVideoDto>>
{
    private readonly IUnitOfWork _unitOfWork;
    public UpdateYouTubeVideoCommandHandler(IUnitOfWork unitOfWork) { _unitOfWork = unitOfWork; }

    public async Task<Result<YouTubeVideoDto>> Handle(UpdateYouTubeVideoCommand request, CancellationToken cancellationToken)
    {
        var video = await _unitOfWork.YouTubeVideos.GetByIdForUserAsync(request.VideoId, request.UserId, cancellationToken);
        if (video is null) return Result<YouTubeVideoDto>.Failure("Video not found.", "VIDEO_NOT_FOUND");

        if (request.Title is not null)
        {
            var title = request.Title.Trim();
            if (string.IsNullOrWhiteSpace(title))
                return Result<YouTubeVideoDto>.Failure("Title is required.", "INVALID_TITLE");
            if (title.Length > 500)
                return Result<YouTubeVideoDto>.Failure("Title must be 500 characters or fewer.", "INVALID_TITLE");
            video.Title = title;
        }
        if (request.Summary is not null) video.Summary = request.Summary;
        if (request.MindMapText is not null) video.MindMapText = request.MindMapText;
        video.UpdatedAt = DateTime.UtcNow;

        await _unitOfWork.SaveChangesAsync(cancellationToken);

        var saved = await _unitOfWork.YouTubeVideos.GetByIdForUserAsync(video.YouTubeVideoId, request.UserId, cancellationToken);
        return Result<YouTubeVideoDto>.Success(SaveYouTubeVideoCommandHandler.ToDto(saved!));
    }
}
