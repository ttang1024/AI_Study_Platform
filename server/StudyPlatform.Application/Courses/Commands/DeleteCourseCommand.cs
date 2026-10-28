using MediatR;
using StudyPlatform.Application.Common;
using StudyPlatform.Application.Services;
using StudyPlatform.Domain.Interfaces;

namespace StudyPlatform.Application.Courses.Commands;

public record DeleteCourseCommand(Guid CourseId, Guid UserId) : IRequest<Result>;

public class DeleteCourseCommandHandler : IRequestHandler<DeleteCourseCommand, Result>
{
    private readonly IUnitOfWork _unitOfWork;
    private readonly ICourseRepository _courses;
    private readonly IDocumentRepository _documents;
    private readonly IVideoRepository _videos;
    private readonly IStoredFileCleanup _storedFiles;
    private readonly IEmbeddingIndex _embeddingIndex;

    public DeleteCourseCommandHandler(
        IUnitOfWork unitOfWork,
        ICourseRepository courses,
        IDocumentRepository documents,
        IVideoRepository videos,
        IStoredFileCleanup storedFiles,
        IEmbeddingIndex embeddingIndex)
    {
        _unitOfWork = unitOfWork;
        _courses = courses;
        _documents = documents;
        _videos = videos;
        _storedFiles = storedFiles;
        _embeddingIndex = embeddingIndex;
    }

    public async Task<Result> Handle(DeleteCourseCommand request, CancellationToken cancellationToken)
    {
        var course = await _courses.GetOwnedAsync(request.CourseId, request.UserId, cancellationToken);
        if (course == null)
            return Result.Failure("Course not found.", "COURSE_NOT_FOUND");

        // Only the file locations, not the rows — the rows themselves go by the Course -> Document and
        // Course -> Video cascades, so loading them (and their text) would be for the URL alone. Uploaded
        // videos count: they are the largest files a course holds, and were never deleted at all.
        var blobUrls = (await _documents.GetBlobUrlsByCourseAsync(request.CourseId, cancellationToken))
            .Concat(await _videos.GetUploadedFileUrlsByCourseAsync(request.CourseId, cancellationToken))
            .ToList();

        _courses.Remove(course);
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        // Only now that the rows are gone (see IStoredFileCleanup).
        await _storedFiles.DeleteAsync(blobUrls, CancellationToken.None);

        // The same cascade that removed the document rows without loading them also removed their
        // flashcards and glossary terms; none of it went through a handler that could clean up chunks.
        await _embeddingIndex.PruneOrphansAsync(request.UserId, cancellationToken);

        return Result.Success("Course deleted successfully.");
    }
}
