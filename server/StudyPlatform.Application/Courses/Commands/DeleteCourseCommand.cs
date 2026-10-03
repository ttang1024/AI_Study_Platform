using MediatR;
using StudyPlatform.Application.Common;
using StudyPlatform.Application.Services;
using StudyPlatform.Domain.Interfaces;

namespace StudyPlatform.Application.Courses.Commands;

public record DeleteCourseCommand(Guid CourseId, Guid UserId) : IRequest<Result>;

public class DeleteCourseCommandHandler : IRequestHandler<DeleteCourseCommand, Result>
{
    private readonly IUnitOfWork _unitOfWork;
    private readonly IBlobStorageService _blobStorageService;
    private readonly IEmbeddingIndex _embeddingIndex;

    public DeleteCourseCommandHandler(
        IUnitOfWork unitOfWork,
        IBlobStorageService blobStorageService,
        IEmbeddingIndex embeddingIndex)
    {
        _unitOfWork = unitOfWork;
        _blobStorageService = blobStorageService;
        _embeddingIndex = embeddingIndex;
    }

    public async Task<Result> Handle(DeleteCourseCommand request, CancellationToken cancellationToken)
    {
        var course = await _unitOfWork.Courses.GetByIdAsync(request.CourseId, cancellationToken);
        if (course == null || course.UserId != request.UserId)
            return Result.Failure("Course not found.", "COURSE_NOT_FOUND");

        // Only the blob locations, not the document rows — the rows themselves are deleted by the
        // Course -> Document cascade, so loading them (and their text) would be for the URL alone.
        var blobUrls = await _unitOfWork.Documents.GetBlobUrlsByCourseAsync(request.CourseId, cancellationToken);
        foreach (var blobUrl in blobUrls)
        {
            try
            {
                await _blobStorageService.DeleteAsync(blobUrl, cancellationToken);
            }
            catch
            {
                // Continue even if blob deletion fails
            }
        }

        _unitOfWork.Courses.Remove(course);
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        // The same cascade that removed the document rows without loading them also removed their
        // flashcards and glossary terms; none of it went through a handler that could clean up chunks.
        await _embeddingIndex.PruneOrphansAsync(request.UserId, cancellationToken);

        return Result.Success("Course deleted successfully.");
    }
}
