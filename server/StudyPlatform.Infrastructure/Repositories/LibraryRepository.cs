using Microsoft.EntityFrameworkCore;
using StudyPlatform.Domain.Interfaces;
using StudyPlatform.Domain.Projections;
using StudyPlatform.Infrastructure.Data;

namespace StudyPlatform.Infrastructure.Repositories;

/// <summary>
/// Merges the Documents and YouTubeVideos tables into one paginated, date-sorted
/// list at the database level (UNION ALL + ORDER BY + OFFSET/LIMIT), so a request
/// reads and returns only the page asked for rather than every row.
/// </summary>
public class LibraryRepository : ILibraryRepository
{
    private readonly AppDbContext _db;

    public LibraryRepository(AppDbContext db) => _db = db;

    public async Task<(IReadOnlyList<LibraryItem> Items, int TotalCount)> GetPagedAsync(
        Guid userId,
        string type,
        Guid? courseId,
        string? search,
        int page,
        int pageSize,
        CancellationToken cancellationToken = default)
    {
        // Type semantics mirror GetUserStatsQuery so the badge counts and the list agree:
        //   article = OriginalUrl set AND text/* content type
        //   audio   = audio/podcast OR audio/* content type
        //   plain document = neither of the above
        var includeDocuments = type != "videos";
        var includeVideos = type is "all" or "videos";

        IQueryable<LibraryItem>? docItems = null;
        if (includeDocuments)
        {
            var docs = _db.Documents.AsNoTracking().Where(d => d.UserId == userId);
            if (courseId.HasValue)
                docs = docs.Where(d => d.CourseId == courseId.Value);
            if (!string.IsNullOrWhiteSpace(search))
                docs = docs.Where(d => EF.Functions.ILike(d.FileName, $"%{search}%"));

            docs = type switch
            {
                "documents" => docs.Where(d =>
                    !(d.OriginalUrl != null && d.ContentType.StartsWith("text/")) &&
                    !(d.ContentType == "audio/podcast" || d.ContentType.StartsWith("audio/"))),
                "articles" => docs.Where(d => d.OriginalUrl != null && d.ContentType.StartsWith("text/")),
                "audio" => docs.Where(d => d.ContentType == "audio/podcast" || d.ContentType.StartsWith("audio/")),
                _ => docs,
            };

            // Both set operands must assign the exact same properties (EF Core
            // requirement for UNION), so video-only fields are set to null here.
            docItems = docs.Select(d => new LibraryItem
            {
                Kind = "document",
                Id = d.DocumentId,
                CourseId = d.CourseId,
                CourseName = d.Course.CourseName,
                CourseColor = d.Course.CourseColor,
                CreatedAt = d.CreatedAt,
                FileName = d.FileName,
                BlobUrl = d.BlobUrl,
                ContentType = d.ContentType,
                FileSize = d.FileSize,
                FileHash = d.FileHash,
                OriginalUrl = d.OriginalUrl,
                Summary = d.Summary,
                Title = null,
                VideoId = null,
                VideoUrl = null,
                ThumbnailUrl = null,
                SourceType = null,
            });
        }

        IQueryable<LibraryItem>? videoItems = null;
        if (includeVideos)
        {
            var videos = _db.YouTubeVideos.AsNoTracking().Where(v => v.UserId == userId);
            if (courseId.HasValue)
                videos = videos.Where(v => v.CourseId == courseId.Value);
            if (!string.IsNullOrWhiteSpace(search))
                videos = videos.Where(v => EF.Functions.ILike(v.Title, $"%{search}%"));

            // Property set must match the document operand exactly (EF Core UNION
            // requirement), so document-only fields are set to null/default here.
            videoItems = videos.Select(v => new LibraryItem
            {
                Kind = "video",
                Id = v.YouTubeVideoId,
                CourseId = v.CourseId,
                CourseName = v.Course.CourseName,
                CourseColor = v.Course.CourseColor,
                CreatedAt = v.CreatedAt,
                FileName = null,
                BlobUrl = null,
                ContentType = null,
                FileSize = 0,
                FileHash = null,
                OriginalUrl = null,
                Summary = null,
                Title = v.Title,
                VideoId = v.VideoId,
                VideoUrl = v.VideoUrl,
                ThumbnailUrl = v.ThumbnailUrl,
                SourceType = string.IsNullOrWhiteSpace(v.SourceType) ? "youtube" : v.SourceType,
            });
        }

        // Exactly one branch may be null depending on the type filter; when both are
        // present they're UNION ALL'd so ORDER BY / OFFSET / LIMIT span both tables.
        var merged = (docItems, videoItems) switch
        {
            (not null, not null) => docItems.Concat(videoItems),
            (not null, null) => docItems,
            (null, not null) => videoItems,
            _ => throw new InvalidOperationException($"Unknown library type filter: {type}"),
        };

        var totalCount = await merged.CountAsync(cancellationToken);

        var items = await merged
            .OrderByDescending(i => i.CreatedAt)
            .ThenByDescending(i => i.Id)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(cancellationToken);

        return (items, totalCount);
    }
}
