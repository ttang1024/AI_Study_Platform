using MediatR;
using StudyPlatform.Application.Common;
using StudyPlatform.Application.Videos.DTOs;
using StudyPlatform.Domain.Interfaces;

namespace StudyPlatform.Application.Videos.Commands;

public record UpdateVideoCommand(
    Guid VideoId,
    Guid UserId,
    string? Title,
    string? Summary,
    string? MindMapText) : IRequest<Result<VideoDto>>;

public class UpdateVideoCommandHandler : IRequestHandler<UpdateVideoCommand, Result<VideoDto>>
{
    private readonly IUnitOfWork _unitOfWork;
    private readonly IVideoRepository _videos;
    public UpdateVideoCommandHandler(IUnitOfWork unitOfWork, IVideoRepository videos) { _unitOfWork = unitOfWork;
    _videos = videos; }

    public async Task<Result<VideoDto>> Handle(UpdateVideoCommand request, CancellationToken cancellationToken)
    {
        var video = await _videos.GetByIdForUserAsync(request.VideoId, request.UserId, cancellationToken);
        if (video is null) return Result<VideoDto>.Failure("Video not found.", "VIDEO_NOT_FOUND");

        if (request.Title is not null)
        {
            var title = request.Title.Trim();
            if (string.IsNullOrWhiteSpace(title))
                return Result<VideoDto>.Failure("Title is required.", "INVALID_TITLE");
            if (title.Length > 500)
                return Result<VideoDto>.Failure("Title must be 500 characters or fewer.", "INVALID_TITLE");
            video.Title = title;
        }
        if (request.Summary is not null) video.Summary = request.Summary;
        if (request.MindMapText is not null) video.MindMapText = request.MindMapText;
        video.UpdatedAt = DateTime.UtcNow;

        await _unitOfWork.SaveChangesAsync(cancellationToken);

        var saved = await _videos.GetByIdForUserAsync(video.VideoId, request.UserId, cancellationToken);
        return Result<VideoDto>.Success(SaveVideoCommandHandler.ToDto(saved!));
    }
}
