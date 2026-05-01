using MediatR;
using StudyPlatform.Application.Common;
using StudyPlatform.Domain.Interfaces;

namespace StudyPlatform.Application.YouTube.Commands;

public record DeleteYouTubeVideoCommand(Guid Id, Guid UserId) : IRequest<Result>;

public class DeleteYouTubeVideoCommandHandler : IRequestHandler<DeleteYouTubeVideoCommand, Result>
{
    private readonly IUnitOfWork _unitOfWork;

    public DeleteYouTubeVideoCommandHandler(IUnitOfWork unitOfWork)
    {
        _unitOfWork = unitOfWork;
    }

    public async Task<Result> Handle(DeleteYouTubeVideoCommand request, CancellationToken cancellationToken)
    {
        var video = await _unitOfWork.YouTubeVideos.GetByIdForUserAsync(request.Id, request.UserId, cancellationToken);
        if (video is null)
            return Result.Failure("Video not found.", "NOT_FOUND");

        _unitOfWork.YouTubeVideos.Remove(video);
        await _unitOfWork.SaveChangesAsync(cancellationToken);
        return Result.Success();
    }
}
