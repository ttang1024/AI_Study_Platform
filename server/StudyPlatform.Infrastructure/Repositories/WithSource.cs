using Microsoft.EntityFrameworkCore;
using StudyPlatform.Domain.Entities;

namespace StudyPlatform.Infrastructure.Repositories;

/// <summary>
/// An artifact row (flashcard, note, glossary term, quiz submission) alongside the handful of columns its
/// source Document/Video actually contributes to a list view: the label, the course, and enough of the
/// content type to tell a document from an article from an audio episode.
/// </summary>
internal sealed class WithSource<T>
{
    public T Entity { get; set; } = default!;

    public Guid? DocumentId { get; set; }
    public Guid? DocumentCourseId { get; set; }
    public string? FileName { get; set; }
    public string? ContentType { get; set; }
    public string? OriginalUrl { get; set; }

    public Guid? VideoId { get; set; }
    public Guid? VideoCourseId { get; set; }
    public string? VideoTitle { get; set; }
}

/// <summary>
/// Loads a user's artifacts with their source label attached, without dragging the source's text with it.
///
/// <c>Include(x =&gt; x.Document)</c> is the obvious spelling, but Document and Video carry the full
/// extracted text, transcript, summary and mind map, and a many-to-one Include repeats every one of those
/// columns on each joined row — a few hundred flashcards over a handful of transcribed sources is tens of
/// megabytes off the wire just to render "from: lecture-3.pdf". Naming the label columns keeps the blobs
/// in the database.
///
/// The stub principals these attach are only safe because the queries are no-tracking: the rows come back
/// detached, so a partially-populated Document can neither confuse the change tracker nor be saved. Keep
/// these off write paths — the same rule as <see cref="Domain.Interfaces.IRepository{T}.FindAsNoTrackingAsync"/>.
/// </summary>
internal static class WithSourceExtensions
{
    public static Task<List<Flashcard>> ToListWithSourcesAsync(
        this IQueryable<Flashcard> query, CancellationToken cancellationToken = default)
        => query
            .Select(f => new WithSource<Flashcard>
            {
                Entity = f,
                DocumentId = (Guid?)f.Document!.DocumentId,
                DocumentCourseId = (Guid?)f.Document!.CourseId,
                FileName = f.Document!.FileName,
                ContentType = f.Document!.ContentType,
                OriginalUrl = f.Document!.OriginalUrl,
                VideoId = (Guid?)f.Video!.VideoId,
                VideoCourseId = (Guid?)f.Video!.CourseId,
                VideoTitle = f.Video!.Title,
            })
            .AttachAsync((e, d, v) => { e.Document = d; e.Video = v; }, cancellationToken);

    public static Task<List<Note>> ToListWithSourcesAsync(
        this IQueryable<Note> query, CancellationToken cancellationToken = default)
        => query
            .Select(n => new WithSource<Note>
            {
                Entity = n,
                DocumentId = (Guid?)n.Document!.DocumentId,
                DocumentCourseId = (Guid?)n.Document!.CourseId,
                FileName = n.Document!.FileName,
                ContentType = n.Document!.ContentType,
                OriginalUrl = n.Document!.OriginalUrl,
                VideoId = (Guid?)n.Video!.VideoId,
                VideoCourseId = (Guid?)n.Video!.CourseId,
                VideoTitle = n.Video!.Title,
            })
            .AttachAsync((e, d, v) => { e.Document = d; e.Video = v; }, cancellationToken);

    public static Task<List<GlossaryTerm>> ToListWithSourcesAsync(
        this IQueryable<GlossaryTerm> query, CancellationToken cancellationToken = default)
        => query
            .Select(t => new WithSource<GlossaryTerm>
            {
                Entity = t,
                DocumentId = (Guid?)t.Document!.DocumentId,
                DocumentCourseId = (Guid?)t.Document!.CourseId,
                FileName = t.Document!.FileName,
                ContentType = t.Document!.ContentType,
                OriginalUrl = t.Document!.OriginalUrl,
                VideoId = (Guid?)t.Video!.VideoId,
                VideoCourseId = (Guid?)t.Video!.CourseId,
                VideoTitle = t.Video!.Title,
            })
            .AttachAsync((e, d, v) => { e.Document = d; e.Video = v; }, cancellationToken);

    public static Task<List<QuizSubmission>> ToListWithSourcesAsync(
        this IQueryable<QuizSubmission> query, CancellationToken cancellationToken = default)
        => query
            .Select(s => new WithSource<QuizSubmission>
            {
                Entity = s,
                DocumentId = (Guid?)s.Document!.DocumentId,
                DocumentCourseId = (Guid?)s.Document!.CourseId,
                FileName = s.Document!.FileName,
                ContentType = s.Document!.ContentType,
                OriginalUrl = s.Document!.OriginalUrl,
                VideoId = (Guid?)s.Video!.VideoId,
                VideoCourseId = (Guid?)s.Video!.CourseId,
                VideoTitle = s.Video!.Title,
            })
            .AttachAsync((e, d, v) => { e.Document = d; e.Video = v; }, cancellationToken);

    private static async Task<List<T>> AttachAsync<T>(
        this IQueryable<WithSource<T>> query,
        Action<T, Document?, Video?> attach,
        CancellationToken cancellationToken)
    {
        var rows = await query.ToListAsync(cancellationToken);
        var entities = new List<T>(rows.Count);
        foreach (var row in rows)
        {
            attach(row.Entity, ToDocument(row), ToVideo(row));
            entities.Add(row.Entity);
        }
        return entities;
    }

    private static Document? ToDocument<T>(WithSource<T> row)
        => row.DocumentId is not { } documentId
            ? null
            : new Document
            {
                DocumentId = documentId,
                CourseId = row.DocumentCourseId ?? Guid.Empty,
                FileName = row.FileName ?? string.Empty,
                ContentType = row.ContentType ?? string.Empty,
                OriginalUrl = row.OriginalUrl,
            };

    private static Video? ToVideo<T>(WithSource<T> row)
        => row.VideoId is not { } videoId
            ? null
            : new Video
            {
                VideoId = videoId,
                CourseId = row.VideoCourseId ?? Guid.Empty,
                Title = row.VideoTitle ?? string.Empty,
            };
}
