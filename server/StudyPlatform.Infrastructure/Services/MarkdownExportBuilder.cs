using System.IO.Compression;
using System.Text;
using Microsoft.EntityFrameworkCore;
using StudyPlatform.Application.Services;
using StudyPlatform.Infrastructure.Data;

namespace StudyPlatform.Infrastructure.Services;

/// <summary>
/// Exports a course as a folder of Markdown notes that opens directly as an Obsidian vault.
///
/// <para>Different from the data export in intent, and therefore in shape: that one is a machine
/// record of everything, this one is meant to be read and edited. So it is Markdown with YAML front
/// matter and <c>[[wiki links]]</c> between notes, and it deliberately leaves out the bookkeeping —
/// review logs, usage, ids — that would be noise in a vault.</para>
/// </summary>
public class MarkdownExportBuilder : IMarkdownExportBuilder
{
    private readonly AppDbContext _db;

    public MarkdownExportBuilder(AppDbContext db)
    {
        _db = db;
    }

    public async Task<(Stream Content, string FileName)?> BuildAsync(
        Guid userId, Guid courseId, CancellationToken cancellationToken = default)
    {
        var course = await _db.Courses
            .AsNoTracking()
            .FirstOrDefaultAsync(c => c.CourseId == courseId && c.UserId == userId, cancellationToken);

        if (course == null)
            return null;

        var buffer = new MemoryStream();

        using (var archive = new ZipArchive(buffer, ZipArchiveMode.Create, leaveOpen: true))
        {
            var documents = await _db.Documents
                .AsNoTracking()
                .Where(d => d.CourseId == courseId && d.UserId == userId)
                .OrderBy(d => d.CreatedAt)
                .Select(d => new { d.DocumentId, d.FileName, d.Summary, d.OriginalUrl, d.CreatedAt })
                .ToListAsync(cancellationToken);

            var videos = await _db.Videos
                .AsNoTracking()
                .Where(v => v.CourseId == courseId && v.UserId == userId)
                .OrderBy(v => v.CreatedAt)
                .Select(v => new { v.VideoId, v.Title, v.Summary, v.VideoUrl, v.CreatedAt })
                .ToListAsync(cancellationToken);

            var notes = await _db.Notes
                .AsNoTracking()
                .Where(n => n.UserId == userId)
                .ToListAsync(cancellationToken);

            var flashcards = await _db.Flashcards
                .AsNoTracking()
                .Where(f => f.UserId == userId)
                .ToListAsync(cancellationToken);

            var glossary = await _db.GlossaryTerms
                .AsNoTracking()
                .Where(g => g.UserId == userId)
                .ToListAsync(cancellationToken);

            var sourceTitles = new List<string>();

            foreach (var doc in documents)
            {
                var title = Sanitize(Path.GetFileNameWithoutExtension(doc.FileName));
                sourceTitles.Add(title);

                var body = new StringBuilder()
                    .AppendLine("---")
                    .AppendLine($"title: \"{Escape(title)}\"")
                    .AppendLine("type: document")
                    .AppendLine($"created: {doc.CreatedAt:yyyy-MM-dd}")
                    .AppendLine(doc.OriginalUrl != null ? $"source: {doc.OriginalUrl}" : "")
                    .AppendLine("---")
                    .AppendLine()
                    .AppendLine($"# {title}")
                    .AppendLine();

                if (!string.IsNullOrWhiteSpace(doc.Summary))
                    body.AppendLine("## Summary").AppendLine().AppendLine(doc.Summary).AppendLine();

                AppendRelated(body, notes
                    .Where(n => n.DocumentId == doc.DocumentId)
                    .Select(n => (n.Title, n.Content)));

                await WriteAsync(archive, $"Sources/{title}.md", body.ToString(), cancellationToken);
            }

            foreach (var video in videos)
            {
                var title = Sanitize(video.Title);
                sourceTitles.Add(title);

                var body = new StringBuilder()
                    .AppendLine("---")
                    .AppendLine($"title: \"{Escape(title)}\"")
                    .AppendLine("type: video")
                    .AppendLine($"created: {video.CreatedAt:yyyy-MM-dd}")
                    .AppendLine($"source: {video.VideoUrl}")
                    .AppendLine("---")
                    .AppendLine()
                    .AppendLine($"# {title}")
                    .AppendLine();

                if (!string.IsNullOrWhiteSpace(video.Summary))
                    body.AppendLine("## Summary").AppendLine().AppendLine(video.Summary).AppendLine();

                AppendRelated(body, notes
                    .Where(n => n.VideoId == video.VideoId)
                    .Select(n => (n.Title, n.Content)));

                await WriteAsync(archive, $"Sources/{title}.md", body.ToString(), cancellationToken);
            }

            if (flashcards.Count > 0)
            {
                var body = new StringBuilder()
                    .AppendLine("---").AppendLine("title: Flashcards").AppendLine("---").AppendLine()
                    .AppendLine("# Flashcards").AppendLine();

                foreach (var card in flashcards)
                {
                    // Obsidian's spaced-repetition plugin reads "::" as the question/answer
                    // separator, so an exported deck is reviewable in the vault rather than inert.
                    body.AppendLine(Inline(card.Front)).AppendLine("?").AppendLine(Inline(card.Back)).AppendLine();
                }

                await WriteAsync(archive, "Flashcards.md", body.ToString(), cancellationToken);
            }

            if (glossary.Count > 0)
            {
                var body = new StringBuilder()
                    .AppendLine("---").AppendLine("title: Glossary").AppendLine("---").AppendLine()
                    .AppendLine("# Glossary").AppendLine();

                foreach (var term in glossary.OrderBy(t => t.Term))
                    body.AppendLine($"## {Inline(term.Term)}").AppendLine().AppendLine(term.Definition).AppendLine();

                await WriteAsync(archive, "Glossary.md", body.ToString(), cancellationToken);
            }

            var index = new StringBuilder()
                .AppendLine("---")
                .AppendLine($"title: \"{Escape(course.CourseName)}\"")
                .AppendLine("---")
                .AppendLine()
                .AppendLine($"# {course.CourseName}")
                .AppendLine()
                .AppendLine($"Exported {DateTime.UtcNow:yyyy-MM-dd} from StudyPlatform.")
                .AppendLine()
                .AppendLine("## Sources")
                .AppendLine();

            foreach (var title in sourceTitles)
                index.AppendLine($"- [[{title}]]");

            index.AppendLine().AppendLine("## Study material").AppendLine();
            if (flashcards.Count > 0) index.AppendLine("- [[Flashcards]]");
            if (glossary.Count > 0) index.AppendLine("- [[Glossary]]");

            await WriteAsync(archive, $"{Sanitize(course.CourseName)}.md", index.ToString(), cancellationToken);
        }

        buffer.Position = 0;
        return (buffer, $"{Sanitize(course.CourseName)}-obsidian.zip");
    }

    private static void AppendRelated(StringBuilder body, IEnumerable<(string Title, string Content)> notes)
    {
        var list = notes.ToList();
        if (list.Count == 0)
            return;

        body.AppendLine("## Notes").AppendLine();
        foreach (var note in list)
            body.AppendLine($"### {Inline(note.Title)}").AppendLine().AppendLine(note.Content).AppendLine();
    }

    private static async Task WriteAsync(
        ZipArchive archive, string path, string content, CancellationToken cancellationToken)
    {
        var entry = archive.CreateEntry(path, CompressionLevel.Optimal);
        await using var stream = entry.Open();
        await stream.WriteAsync(Encoding.UTF8.GetBytes(content), cancellationToken);
    }

    /// <summary>
    /// Makes a title safe as a filename and as a wiki-link target.
    ///
    /// <para>Both matter and they overlap: <c>[[</c>, <c>]]</c>, <c>#</c>, <c>|</c> and <c>^</c> are
    /// Obsidian link syntax, and the rest are path separators. A title carrying any of them yields a
    /// note that either cannot be written or cannot be linked to.</para>
    /// </summary>
    private static string Sanitize(string title)
    {
        if (string.IsNullOrWhiteSpace(title))
            return "Untitled";

        var cleaned = new string(title
            .Select(c => Path.GetInvalidFileNameChars().Contains(c) || "[]#|^\\/:".Contains(c) ? ' ' : c)
            .ToArray());

        cleaned = string.Join(' ', cleaned.Split(' ', StringSplitOptions.RemoveEmptyEntries)).Trim();

        // Long titles blow past filesystem name limits once the .md and folder are added.
        if (cleaned.Length > 120)
            cleaned = cleaned[..120].TrimEnd();

        return cleaned.Length == 0 ? "Untitled" : cleaned;
    }

    private static string Escape(string value) => value.Replace("\"", "\\\"");

    /// <summary>Flattens newlines so a multi-line value cannot break the single-line syntax around it.</summary>
    private static string Inline(string value)
        => value.Replace("\r", " ").Replace("\n", " ").Trim();
}
