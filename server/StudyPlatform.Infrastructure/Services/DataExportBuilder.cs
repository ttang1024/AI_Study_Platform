using System.IO.Compression;
using System.Text;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using StudyPlatform.Application.Services;
using StudyPlatform.Infrastructure.Data;

namespace StudyPlatform.Infrastructure.Services;

/// <summary>
/// Builds the ZIP a user gets when they ask for their data.
///
/// <para>Everything is written as JSON, one file per kind of thing, plus a README naming what each
/// file holds. JSON rather than CSV because most of this data is nested — a quiz has questions, an
/// essay has criterion-level feedback — and flattening it would make the export lossy in exactly the
/// way an export must not be.</para>
///
/// <para>Buffered to a temporary file rather than memory: a heavy library's transcripts and notes run
/// to hundreds of megabytes, and holding that per concurrent export is how the API process dies.
/// The stream deletes itself on close.</para>
/// </summary>
public class DataExportBuilder : IDataExportBuilder
{
    private static readonly JsonSerializerOptions JsonOptions = new() { WriteIndented = true };

    private readonly AppDbContext _db;

    public DataExportBuilder(AppDbContext db)
    {
        _db = db;
    }

    public async Task<Stream> BuildAsync(Guid userId, CancellationToken cancellationToken = default)
    {
        var buffer = new FileStream(
            Path.Combine(Path.GetTempPath(), $"export-{Guid.NewGuid():N}.zip"),
            FileMode.Create, FileAccess.ReadWrite, FileShare.None,
            bufferSize: 81920,
            FileOptions.DeleteOnClose | FileOptions.Asynchronous);

        // leaveOpen so disposing the archive flushes the central directory without closing the
        // stream the caller is about to read.
        using (var archive = new ZipArchive(buffer, ZipArchiveMode.Create, leaveOpen: true))
        {
            await WriteReadmeAsync(archive, cancellationToken);

            await WriteJsonAsync(archive, "account.json", await _db.Users
                .AsNoTracking()
                .Where(u => u.UserId == userId)
                .Select(u => new
                {
                    u.UserId,
                    u.Email,
                    u.FullName,
                    u.IsEmailVerified,
                    u.DailyStudyGoalMinutes,
                    u.CreatedAt,
                    u.UpdatedAt,
                })
                .FirstOrDefaultAsync(cancellationToken), cancellationToken);

            await WriteJsonAsync(archive, "courses.json", await _db.Courses
                .AsNoTracking().Where(c => c.UserId == userId)
                .OrderBy(c => c.CreatedAt).ToListAsync(cancellationToken), cancellationToken);

            await WriteJsonAsync(archive, "documents.json", await _db.Documents
                .AsNoTracking().Where(d => d.UserId == userId)
                .OrderBy(d => d.CreatedAt)
                .Select(d => new
                {
                    d.DocumentId,
                    d.CourseId,
                    d.FileName,
                    d.ContentType,
                    d.FileSize,
                    d.Summary,
                    d.MindMapText,
                    d.Transcript,
                    d.ExtractedText,
                    d.OriginalUrl,
                    d.CreatedAt,
                })
                .ToListAsync(cancellationToken), cancellationToken);

            await WriteJsonAsync(archive, "videos.json", await _db.Videos
                .AsNoTracking().Where(v => v.UserId == userId)
                .OrderBy(v => v.CreatedAt).ToListAsync(cancellationToken), cancellationToken);

            await WriteJsonAsync(archive, "flashcards.json", await _db.Flashcards
                .AsNoTracking().Where(f => f.UserId == userId)
                .OrderBy(f => f.CreatedAt).ToListAsync(cancellationToken), cancellationToken);

            await WriteJsonAsync(archive, "flashcard-review-history.json", await _db.FlashcardReviewLogs
                .AsNoTracking().Where(l => l.UserId == userId)
                .OrderBy(l => l.ReviewedAt).ToListAsync(cancellationToken), cancellationToken);

            await WriteJsonAsync(archive, "spaced-repetition-state.json", await _db.FlashcardSrs
                .AsNoTracking().Where(s => s.UserId == userId).ToListAsync(cancellationToken), cancellationToken);

            await WriteJsonAsync(archive, "quizzes.json", await _db.Quizzes
                .AsNoTracking().Where(q => q.UserId == userId)
                .OrderBy(q => q.CreatedAt).ToListAsync(cancellationToken), cancellationToken);

            await WriteJsonAsync(archive, "quiz-submissions.json", await _db.QuizSubmissions
                .AsNoTracking().Where(s => s.UserId == userId).ToListAsync(cancellationToken), cancellationToken);

            await WriteJsonAsync(archive, "notes.json", await _db.Notes
                .AsNoTracking().Where(n => n.UserId == userId)
                .OrderBy(n => n.CreatedAt).ToListAsync(cancellationToken), cancellationToken);

            await WriteJsonAsync(archive, "glossary.json", await _db.GlossaryTerms
                .AsNoTracking().Where(g => g.UserId == userId).ToListAsync(cancellationToken), cancellationToken);

            await WriteJsonAsync(archive, "worked-problems.json", await _db.WorkedProblems
                .AsNoTracking().Where(w => w.UserId == userId).ToListAsync(cancellationToken), cancellationToken);

            await WriteJsonAsync(archive, "mistakes.json", await _db.MistakeEntries
                .AsNoTracking().Where(m => m.UserId == userId)
                .OrderBy(m => m.FirstMissedAt).ToListAsync(cancellationToken), cancellationToken);

            await WriteJsonAsync(archive, "essays.json", await _db.EssaySubmissions
                .AsNoTracking().Where(e => e.UserId == userId)
                .OrderBy(e => e.CreatedAt).ToListAsync(cancellationToken), cancellationToken);

            await WriteJsonAsync(archive, "annotations.json", await _db.DocumentAnnotations
                .AsNoTracking().Where(a => a.UserId == userId).ToListAsync(cancellationToken), cancellationToken);

            await WriteJsonAsync(archive, "study-sessions.json", await _db.StudySessions
                .AsNoTracking().Where(s => s.UserId == userId)
                .OrderBy(s => s.OccurredAt).ToListAsync(cancellationToken), cancellationToken);

            await WriteJsonAsync(archive, "chat-history.json", await _db.ChatMessages
                .AsNoTracking().Where(m => m.UserId == userId)
                .OrderBy(m => m.CreatedAt).ToListAsync(cancellationToken), cancellationToken);

            await WriteJsonAsync(archive, "exam-plans.json", await _db.ExamPlans
                .AsNoTracking().Where(p => p.UserId == userId).ToListAsync(cancellationToken), cancellationToken);

            await WriteJsonAsync(archive, "ai-usage.json", await _db.AiUsageLogs
                .AsNoTracking().Where(u => u.UserId == userId)
                .OrderBy(u => u.CreatedAt).ToListAsync(cancellationToken), cancellationToken);

            await WriteJsonAsync(archive, "security-log.json", await _db.AuditLogEntries
                .AsNoTracking()
                .Where(e => e.ActorUserId == userId || e.SubjectUserId == userId)
                .OrderBy(e => e.CreatedAt).ToListAsync(cancellationToken), cancellationToken);
        }

        buffer.Position = 0;
        return buffer;
    }

    private static async Task WriteReadmeAsync(ZipArchive archive, CancellationToken cancellationToken)
    {
        var readme = new StringBuilder()
            .AppendLine("# Your StudyPlatform data")
            .AppendLine()
            .AppendLine($"Exported {DateTime.UtcNow:yyyy-MM-dd HH:mm} UTC.")
            .AppendLine()
            .AppendLine("Every file is JSON, encoded UTF-8.")
            .AppendLine()
            .AppendLine("| File | Contents |")
            .AppendLine("| --- | --- |")
            .AppendLine("| account.json | Your profile and settings |")
            .AppendLine("| courses.json | Courses you created |")
            .AppendLine("| documents.json | Uploaded documents, with extracted text and summaries |")
            .AppendLine("| videos.json | Videos in your library, with transcripts |")
            .AppendLine("| flashcards.json | Every flashcard |")
            .AppendLine("| flashcard-review-history.json | Each review you've logged |")
            .AppendLine("| spaced-repetition-state.json | FSRS scheduling state per card |")
            .AppendLine("| quizzes.json / quiz-submissions.json | Quizzes and your attempts |")
            .AppendLine("| notes.json | Your notes |")
            .AppendLine("| glossary.json | Glossary terms |")
            .AppendLine("| worked-problems.json | Worked problems |")
            .AppendLine("| mistakes.json | Your mistakes notebook |")
            .AppendLine("| essays.json | Essay drafts and their feedback |")
            .AppendLine("| annotations.json | Highlights and comments on documents |")
            .AppendLine("| study-sessions.json | Study session history |")
            .AppendLine("| chat-history.json | Conversations with the AI tutor |")
            .AppendLine("| exam-plans.json | Exam plans |")
            .AppendLine("| ai-usage.json | Your AI token usage |")
            .AppendLine("| security-log.json | Sign-ins and account changes |")
            .AppendLine()
            .AppendLine("Source files themselves (the original PDFs, images, and audio you uploaded)")
            .AppendLine("are not in this archive — download those from your library.")
            .ToString();

        await WriteEntryAsync(archive, "README.md", Encoding.UTF8.GetBytes(readme), cancellationToken);
    }

    private static async Task WriteJsonAsync<T>(
        ZipArchive archive, string name, T payload, CancellationToken cancellationToken)
    {
        var bytes = JsonSerializer.SerializeToUtf8Bytes(payload, JsonOptions);
        await WriteEntryAsync(archive, name, bytes, cancellationToken);
    }

    private static async Task WriteEntryAsync(
        ZipArchive archive, string name, byte[] bytes, CancellationToken cancellationToken)
    {
        var entry = archive.CreateEntry(name, CompressionLevel.Optimal);
        await using var stream = entry.Open();
        await stream.WriteAsync(bytes, cancellationToken);
    }
}
