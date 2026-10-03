using MediatR;
using StudyPlatform.Application.Common;
using StudyPlatform.Application.Services;
using StudyPlatform.Domain.Interfaces;

namespace StudyPlatform.Application.Videos.Commands;

public record DeleteVideoCommand(Guid Id, Guid UserId) : IRequest<Result>;

public class DeleteVideoCommandHandler : IRequestHandler<DeleteVideoCommand, Result>
{
    private readonly IUnitOfWork _unitOfWork;
    private readonly IEmbeddingIndex _embeddingIndex;

    public DeleteVideoCommandHandler(IUnitOfWork unitOfWork, IEmbeddingIndex embeddingIndex)
    {
        _unitOfWork = unitOfWork;
        _embeddingIndex = embeddingIndex;
    }

    public async Task<Result> Handle(DeleteVideoCommand request, CancellationToken cancellationToken)
    {
        var video = await _unitOfWork.Videos.GetByIdForUserAsync(request.Id, request.UserId, cancellationToken);
        if (video is null)
            return Result.Failure("Video not found.", "NOT_FOUND");

        _unitOfWork.Videos.Remove(video);

        // The tag join is polymorphic, so no foreign key reaches it and no cascade fires. Pruned
        // here or the assignment outlives the video and inflates every collection's item count.
        await _unitOfWork.LibraryTags.RemoveAssignmentsForItemAsync(
            "video", video.VideoId, cancellationToken);

        await _unitOfWork.SaveChangesAsync(cancellationToken);

        // Covers the video's own transcript chunks and those of the flashcards and glossary terms the
        // cascade takes with it.
        await _embeddingIndex.PruneOrphansAsync(request.UserId, cancellationToken);

        return Result.Success();
    }
}
