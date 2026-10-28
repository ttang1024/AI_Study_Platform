using MediatR;
using StudyPlatform.Application.Common;
using StudyPlatform.Application.Services;
using StudyPlatform.Domain.Interfaces;

namespace StudyPlatform.Application.Videos.Commands;

public record DeleteVideoCommand(Guid Id, Guid UserId) : IRequest<Result>;

public class DeleteVideoCommandHandler : IRequestHandler<DeleteVideoCommand, Result>
{
    private readonly IUnitOfWork _unitOfWork;
    private readonly IVideoRepository _videos;
    private readonly ILibraryTagRepository _libraryTags;
    private readonly IEmbeddingIndex _embeddingIndex;
    private readonly IStoredFileCleanup _storedFiles;

    public DeleteVideoCommandHandler(IUnitOfWork unitOfWork, IVideoRepository videos, ILibraryTagRepository libraryTags, IEmbeddingIndex embeddingIndex, IStoredFileCleanup storedFiles)
    {
        _storedFiles = storedFiles;
        _unitOfWork = unitOfWork;
        _videos = videos;
        _libraryTags = libraryTags;
        _embeddingIndex = embeddingIndex;
    }

    public async Task<Result> Handle(DeleteVideoCommand request, CancellationToken cancellationToken)
    {
        var video = await _videos.GetByIdForUserAsync(request.Id, request.UserId, cancellationToken);
        if (video is null)
            return Result.Failure("Video not found.", "NOT_FOUND");

        _videos.Remove(video);

        // The tag join is polymorphic, so no foreign key reaches it and no cascade fires. Pruned
        // here or the assignment outlives the video and inflates every collection's item count.
        await _libraryTags.RemoveAssignmentsForItemAsync(
            "video", video.VideoId, cancellationToken);

        await _unitOfWork.SaveChangesAsync(cancellationToken);

        // An upload's file and cover are ours to delete (a linked video's URL and thumbnail are someone
        // else's); they used to stay in the bucket forever, up to 500 MB apiece.
        if (string.Equals(video.SourceType, "upload", StringComparison.OrdinalIgnoreCase))
            await _storedFiles.DeleteAsync([video.VideoUrl, video.ThumbnailUrl], CancellationToken.None);

        // Covers the video's own transcript chunks and those of the flashcards and glossary terms the
        // cascade takes with it.
        await _embeddingIndex.PruneOrphansAsync(request.UserId, cancellationToken);

        return Result.Success();
    }
}
