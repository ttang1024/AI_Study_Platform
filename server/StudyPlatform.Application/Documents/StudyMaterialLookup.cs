using System.Linq.Expressions;
using StudyPlatform.Application.Documents.DTOs;
using StudyPlatform.Application.Services;
using StudyPlatform.Domain.Entities;
using StudyPlatform.Domain.Interfaces;

namespace StudyPlatform.Application.Documents;

/// <inheritdoc cref="IStudyMaterialLookup"/>
public class StudyMaterialLookup : IStudyMaterialLookup
{
    private const string FallbackCourseColor = "#a1a1aa";

    private readonly IUnitOfWork _unitOfWork;

    public StudyMaterialLookup(IUnitOfWork unitOfWork)
    {
        _unitOfWork = unitOfWork;
    }

    public Task<IEnumerable<PendingMaterialDto>> ListUncoveredAsync(
        Guid userId,
        IEnumerable<Guid> coveredDocumentIds,
        IEnumerable<Guid> coveredVideoIds,
        CancellationToken cancellationToken = default)
    {
        var documentIds = coveredDocumentIds.ToHashSet();
        var videoIds = coveredVideoIds.ToHashSet();
        return ListAsync(
            userId,
            d => d.UserId == userId && !documentIds.Contains(d.DocumentId),
            v => v.UserId == userId && !videoIds.Contains(v.VideoId),
            cancellationToken);
    }

    public Task<IEnumerable<PendingMaterialDto>> ListSelectedAsync(
        Guid userId,
        IReadOnlySet<Guid> documentIds,
        IReadOnlySet<Guid> videoIds,
        CancellationToken cancellationToken = default)
        => ListAsync(
            userId,
            d => d.UserId == userId && documentIds.Contains(d.DocumentId),
            v => v.UserId == userId && videoIds.Contains(v.VideoId),
            cancellationToken);

    private async Task<IEnumerable<PendingMaterialDto>> ListAsync(
        Guid userId,
        Expression<Func<Document, bool>> documentFilter,
        Expression<Func<Video, bool>> videoFilter,
        CancellationToken cancellationToken)
    {
        var courseMap = (await _unitOfWork.Courses.FindAsNoTrackingAsync(
                c => c.UserId == userId, cancellationToken))
            .ToDictionary(c => c.CourseId);

        var documents = (await _unitOfWork.Documents.FindAsNoTrackingAsync(documentFilter, cancellationToken))
            .Select(d => ToMaterial(d, courseMap));

        var videos = (await _unitOfWork.Videos.FindAsNoTrackingAsync(videoFilter, cancellationToken))
            .Select(v => ToMaterial(v, courseMap));

        return documents.Concat(videos).OrderByDescending(m => m.CreatedAt);
    }

    private static PendingMaterialDto ToMaterial(Document d, IReadOnlyDictionary<Guid, Course> courseMap)
    {
        courseMap.TryGetValue(d.CourseId, out var course);
        return new PendingMaterialDto(
            "document",
            d.DocumentId,
            d.CourseId,
            course?.CourseName ?? string.Empty,
            course?.CourseColor ?? FallbackCourseColor,
            d.FileName,
            d.ContentType,
            d.BlobUrl,
            d.OriginalUrl,
            null,
            null,
            null,
            d.CreatedAt);
    }

    private static PendingMaterialDto ToMaterial(Video v, IReadOnlyDictionary<Guid, Course> courseMap)
    {
        courseMap.TryGetValue(v.CourseId, out var course);
        return new PendingMaterialDto(
            "video",
            v.VideoId,
            v.CourseId,
            course?.CourseName ?? string.Empty,
            course?.CourseColor ?? FallbackCourseColor,
            v.Title,
            null,
            null,
            null,
            v.ExternalVideoId,
            v.VideoUrl,
            v.ThumbnailUrl,
            v.CreatedAt,
            v.SourceType);
    }
}
