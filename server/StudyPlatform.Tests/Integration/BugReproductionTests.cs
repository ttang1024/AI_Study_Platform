using System.Text;
using MediatR;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Distributed;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using StudyPlatform.Application.Common;
using StudyPlatform.Application.Flashcards.Commands;
using StudyPlatform.Application.Library.Queries;
using StudyPlatform.Application.Mistakes;
using StudyPlatform.Application.Planner;
using StudyPlatform.Application.Practice.Queries;
using StudyPlatform.Application.Settings;
using StudyPlatform.Domain.Entities;
using StudyPlatform.Infrastructure.Services;
using Xunit;

namespace StudyPlatform.Tests.Integration;

// Reproductions for the bug-hunt findings. Each runs the real handlers, through MediatR, against a real
// Postgres, so the assertions hold whatever constructor changes the fixes need. Each failed before its fix.
[Collection(PostgresCollection.Name)]
public class BugReproductionTests : IDisposable
{
    private readonly PostgresFixture _db;
    private readonly WebApplicationFactory<Program> _api;

    public BugReproductionTests(PostgresFixture db)
    {
        _db = db;
        _api = new WebApplicationFactory<Program>().WithWebHostBuilder(builder =>
        {
            builder.UseEnvironment("Testing");
            builder.UseSetting("ConnectionStrings:DefaultConnection", db.ConnectionString);
            builder.UseSetting("JwtSettings:SecretKey", new string('k', 64));
            builder.UseSetting("Redis:Enabled", "false");
            builder.UseSetting("S3:BucketName", "bug-repro");
        });
    }

    public void Dispose() => _api.Dispose();

    private async Task<T> SendAsync<T>(IRequest<T> request)
    {
        using var scope = _api.Services.CreateScope();
        return await scope.ServiceProvider.GetRequiredService<IMediator>().Send(request);
    }

    private async Task<(Guid UserId, Guid DocumentId)> SeedUserWithDocumentAsync(string? timeZone = null, params string[] fileNames)
    {
        var now = DateTime.UtcNow;
        var userId = Guid.NewGuid();
        var courseId = Guid.NewGuid();
        var documentId = Guid.NewGuid();
        await using var seed = _db.NewContext();
        seed.Users.Add(new User
        {
            UserId = userId, Email = $"{userId:N}@example.com", FullName = "Test", PasswordHash = "x",
            TimeZone = timeZone, CreatedAt = now, UpdatedAt = now,
        });
        seed.Courses.Add(new Course { CourseId = courseId, UserId = userId, CourseName = "C", CreatedAt = now, UpdatedAt = now });
        var names = fileNames.Length == 0 ? ["notes.pdf"] : fileNames;
        for (var i = 0; i < names.Length; i++)
            seed.Documents.Add(new Document
            {
                DocumentId = i == 0 ? documentId : Guid.NewGuid(), UserId = userId, CourseId = courseId,
                FileName = names[i], BlobUrl = "b", ContentType = "application/pdf", CreatedAt = now.AddSeconds(-i), UpdatedAt = now,
            });
        await seed.SaveChangesAsync();
        return (userId, documentId);
    }

    // ── 0. Account erasure threw on every attempt under the retrying execution strategy ─────────────

    [DockerFact]
    public async Task AccountEraser_UnderTheProductionExecutionStrategy_ErasesTheAccount()
    {
        var (userId, _) = await SeedUserWithDocumentAsync();

        // Resolved from the real composition, so the DbContext carries EnableRetryOnFailure. A transaction
        // begun outside the strategy failed with "does not support user-initiated transactions".
        using (var scope = _api.Services.CreateScope())
        {
            var eraser = scope.ServiceProvider.GetRequiredService<StudyPlatform.Application.Services.IAccountEraser>();
            Assert.True(await eraser.EraseAsync(userId));
        }

        await using var check = _db.NewContext();
        Assert.False(await check.Users.AnyAsync(u => u.UserId == userId));
        Assert.False(await check.Documents.AnyAsync(d => d.UserId == userId));
    }

    [DockerFact]
    public async Task AccountEraser_DeletesUploadedVideosAndCovers_NotLinkedVideosUrls()
    {
        var (userId, _) = await SeedUserWithDocumentAsync();
        await using (var seed = _db.NewContext())
        {
            var courseId = await seed.Courses.Where(c => c.UserId == userId).Select(c => c.CourseId).SingleAsync();
            foreach (var (source, url, cover) in new[] { ("upload", "blob://lecture.mp4", "blob://cover.jpg"), ("youtube", "https://youtu.be/x", "https://i.ytimg.com/x.jpg") })
                seed.Videos.Add(new Video
                {
                    VideoId = Guid.NewGuid(), UserId = userId, CourseId = courseId, ExternalVideoId = Guid.NewGuid().ToString("N"),
                    VideoUrl = url, ThumbnailUrl = cover, SourceType = source, Title = "T", CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow,
                });
            await seed.SaveChangesAsync();
        }
        var deleted = new List<string>();
        var blobs = new Moq.Mock<StudyPlatform.Application.Services.IBlobStorageService>();
        blobs.Setup(b => b.DeleteAsync(Moq.It.IsAny<string>(), Moq.It.IsAny<CancellationToken>()))
            .Callback((string url, CancellationToken _) => deleted.Add(url)).Returns(Task.CompletedTask);

        await using (var context = _db.NewContext())
            Assert.True(await new AccountEraser(context, blobs.Object, NullLogger<AccountEraser>.Instance).EraseAsync(userId));

        // Uploads were never collected: an erased account's lecture recordings stayed in the bucket.
        Assert.Contains("blob://lecture.mp4", deleted);
        Assert.Contains("blob://cover.jpg", deleted);
        Assert.DoesNotContain("https://youtu.be/x", deleted);
    }

    // ── 0b. Concurrent guesses at a reset code all got through the 5-guess cap ─────────────────────

    [DockerFact]
    public async Task PasswordResetCode_ConcurrentWrongGuesses_StillCappedAtFive()
    {
        var (userId, _) = await SeedUserWithDocumentAsync();
        var email = $"{userId:N}@example.com";
        await using (var seed = _db.NewContext())
        {
            seed.OtpCodes.Add(new OtpCode
            {
                OtpId = Guid.NewGuid(), Email = email, Code = "123456", Purpose = StudyPlatform.Domain.Enums.OtpPurpose.PasswordReset,
                UserId = userId, ExpiresAt = DateTime.UtcNow.AddMinutes(10), CreatedAt = DateTime.UtcNow,
            });
            await seed.SaveChangesAsync();
        }

        // Twenty wrong guesses at once, each its own request scope. Counting on the loaded row let every one
        // of them read FailedAttempts = 0 and save 1.
        await Task.WhenAll(Enumerable.Range(0, 20).Select(i =>
            SendAsync(new StudyPlatform.Application.Auth.Commands.ResetPasswordCommand(email, $"{i:000000}", "NewPass1!"))));

        await using var check = _db.NewContext();
        var otp = await check.OtpCodes.SingleAsync(o => o.Email == email);
        Assert.Equal(StudyPlatform.Application.Auth.OtpVerifier.MaxFailedAttempts, otp.FailedAttempts);

        // ...and with the cap spent, the right code no longer works either.
        var correct = await SendAsync(new StudyPlatform.Application.Auth.Commands.ResetPasswordCommand(email, "123456", "NewPass1!"));
        Assert.False(correct.IsSuccess);
    }

    // ── 0c. Parallel uploads all passed a separate count and together exceeded the upload limit ────

    [DockerFact]
    public async Task ParallelUploads_AtTheLimit_OnlyFillTheRemainingSlots()
    {
        var (userId, _) = await SeedUserWithDocumentAsync();
        Guid courseId;
        await using (var seed = _db.NewContext())
            courseId = await seed.Courses.Where(c => c.UserId == userId).Select(c => c.CourseId).SingleAsync();

        // Limit 3, eight at once, each its own request scope and context.
        var results = await Task.WhenAll(Enumerable.Range(0, 8).Select(async i =>
        {
            await using var context = _db.NewContext();
            return await new StudyPlatform.Infrastructure.Repositories.VideoRepository(context).AddUploadWithinLimitAsync(new Video
            {
                VideoId = Guid.NewGuid(), UserId = userId, CourseId = courseId, ExternalVideoId = $"upload-{Guid.NewGuid():N}",
                VideoUrl = $"blob://{i}", ThumbnailUrl = "", SourceType = "upload", Title = "T", CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow,
            }, limit: 3);
        }));

        Assert.Equal(3, results.Count(r => r));
        await using var check = _db.NewContext();
        Assert.Equal(3, await check.Videos.CountAsync(v => v.UserId == userId && v.SourceType == "upload"));
    }

    [DockerFact]
    public async Task SourceCourses_AreProjectedWithoutTheTextColumns()
    {
        var (userId, documentId) = await SeedUserWithDocumentAsync(null, "notes.pdf");
        await using var context = _db.NewContext();

        var sources = await new StudyPlatform.Infrastructure.Repositories.DocumentRepository(context).GetSourceCoursesByUserAsync(userId);

        Assert.Equal(documentId, Assert.Single(sources).Id);
        Assert.Equal("notes.pdf", sources[0].Name);
    }

    // ── 1. A promoted mistake's flashcard can never be reviewed ─────────────────────────────────────

    [DockerFact]
    public async Task PromotedMistakeFlashcard_FirstReview_Succeeds()
    {
        var (userId, documentId) = await SeedUserWithDocumentAsync();
        await using (var seed = _db.NewContext())
        {
            seed.MistakeEntries.Add(new MistakeEntry
            {
                MistakeEntryId = Guid.NewGuid(), UserId = userId, DocumentId = documentId, Question = "2+2?",
                CorrectAnswer = "4", UserAnswer = "5", FirstMissedAt = DateTime.UtcNow, LastMissedAt = DateTime.UtcNow,
            });
            await seed.SaveChangesAsync();
        }

        var promoted = await SendAsync(new PromoteMistakesToFlashcardsCommand(userId, []));
        var cardId = Assert.Single(promoted.Data!.FlashcardIds);

        // Promotion writes a Reps=0 SRS row; the review handler sees Reps become 1 and Adds that row
        // again, so SaveChanges INSERTs a duplicate primary key. Today this throws DbUpdateException.
        var review = await SendAsync(new ReviewFlashcardCommand(cardId, userId, Rating: 3));

        Assert.True(review.IsSuccess);
        await using var check = _db.NewContext();
        var srs = await check.FlashcardSrs.SingleAsync(s => s.FlashcardId == cardId);
        Assert.Equal(1, srs.Reps);
        Assert.True(srs.Due > DateTime.UtcNow);
    }

    // ── 2. Exam planner counts days in UTC, not the user's calendar ─────────────────────────────────

    [DockerFact]
    public async Task ExamPlan_DaysRemaining_FollowsTheUsersCalendar()
    {
        // A zone whose date differs from UTC's right now (with an hour of margin either side):
        // UTC+14 is a day ahead from 10:00 UTC on, UTC-12 a day behind until 12:00 UTC.
        var utcNow = DateTime.UtcNow;
        var zoneId = utcNow.Hour >= 11 ? "Pacific/Kiritimati" : "Etc/GMT+12";
        var localToday = UserCalendar.LocalDate(utcNow, UserCalendar.Resolve(zoneId));
        Assert.NotEqual(utcNow.Date, localToday); // precondition

        var (userId, _) = await SeedUserWithDocumentAsync(zoneId);

        var created = await SendAsync(new CreateExamPlanCommand(userId, "Finals", localToday.AddDays(1), null, 30));

        Assert.True(created.IsSuccess);
        // The exam is tomorrow for this user. Today the handler says 2 (UTC+14) or 0 (UTC-12).
        Assert.Equal(1, created.Data!.DaysRemaining);
    }

    // ── 3. Library search treats % and _ as wildcards ───────────────────────────────────────────────

    [DockerFact]
    public async Task LibrarySearch_PercentAndUnderscore_MatchLiterally()
    {
        var (userId, _) = await SeedUserWithDocumentAsync(null, "notes.pdf", "100% done.pdf", "file_1.pdf", "fileX1.pdf");

        var percent = await SendAsync(new GetLibraryQuery(userId, "all", null, "%", 1, 20));
        var underscore = await SendAsync(new GetLibraryQuery(userId, "all", null, "file_1", 1, 20));

        // Today "%" returns all four documents and "file_1" also matches "fileX1.pdf".
        Assert.Equal(["100% done.pdf"], percent.Data!.Items.Select(i => i.FileName));
        Assert.Equal(["file_1.pdf"], underscore.Data!.Items.Select(i => i.FileName));
    }

    // ── 4. Practice submission: one stale id 500s the request after reviews were committed ─────────

    [DockerFact]
    public async Task PracticeSubmission_WithADeletedGlossaryTerm_DoesNotHalfCommit()
    {
        var (userId, documentId) = await SeedUserWithDocumentAsync();
        var cardId = Guid.NewGuid();
        await using (var seed = _db.NewContext())
        {
            seed.Flashcards.Add(new Flashcard
            {
                FlashcardId = cardId, UserId = userId, DocumentId = documentId, Front = "Q", Back = "A",
                CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow,
            });
            await seed.SaveChangesAsync();
        }

        // The glossary term was in the session but deleted (with its document) before the user submitted.
        var results = new[]
        {
            new PracticeResultItem("flashcard", cardId, true),
            new PracticeResultItem("glossary", Guid.NewGuid(), true),
        };

        // Today: the flashcard review is committed by ReviewFlashcardCommand's own SaveChanges, then the
        // final SaveChanges hits the GlossaryMastered FK and throws — a 500 the client will retry.
        var exception = await Record.ExceptionAsync(() => SendAsync(new SubmitPracticeTestCommand(userId, results)));

        Assert.Null(exception);
        await using var check = _db.NewContext();
        Assert.Equal(1, await check.FlashcardReviewLogs.CountAsync(l => l.FlashcardId == cardId));
        Assert.Equal(0, await check.GlossaryMastered.CountAsync(m => m.UserId == userId));
    }

    // ── 5. A Redis hit backfills short-lived summaries into Postgres for 30 days ───────────────────

    [DockerFact]
    public async Task RedisHit_OnUserSummaryKey_DoesNotBackfillPostgresFor30Days()
    {
        var redis = new MemoryDistributedCache(Options.Create(new MemoryDistributedCacheOptions()));
        var cache = new DistributedAppCache(
            redis, _api.Services.GetRequiredService<IServiceScopeFactory>(),
            NullLogger<DistributedAppCache>.Instance, Options.Create(new CacheOptions()));

        // The state RemoveAsync leaves behind when it runs inside the Redis skip window: the Postgres row is
        // gone, Redis still holds the old (pre-invalidation) summary for the rest of its 30-second TTL.
        var key = $"dashboard-summary:user:{Guid.NewGuid()}";
        await redis.SetAsync(key, Encoding.UTF8.GetBytes("""{"stale":true}"""),
            new DistributedCacheEntryOptions { AbsoluteExpirationRelativeToNow = TimeSpan.FromSeconds(30) });

        await cache.GetAsync<Dictionary<string, bool>>(key);

        await using var check = _db.NewContext();
        var entry = await check.CacheEntries.SingleOrDefaultAsync(e => e.Key == key);
        // Today the backfill writes GeneratedResultSeconds (30 days): once Redis lets the key go, every
        // read falls through to this row and serves the stale summary for a month.
        Assert.True(entry == null || entry.ExpiresAt <= DateTime.UtcNow.AddMinutes(5),
            $"backfilled to expire at {entry?.ExpiresAt:O}");
    }
}
