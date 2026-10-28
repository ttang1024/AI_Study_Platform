using MediatR;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using StudyPlatform.Application.Flashcards.Commands;
using StudyPlatform.Application.StudyGroups;
using StudyPlatform.Domain.Entities;
using StudyPlatform.Domain.Exceptions;
using Xunit;

namespace StudyPlatform.Tests.Integration;

/// <summary>
/// The same write arriving twice at once — a double-tap on a rating, two tabs, a client retry. The
/// promise is: one wins, the other gets a 409 (ConcurrencyConflictException), and the data shows the
/// write exactly once. A 500, or a doubled row, is the failure these guard against.
/// </summary>
[Collection(PostgresCollection.Name)]
public class ConcurrentWriteTests : IDisposable
{
    private readonly PostgresFixture _db;
    private readonly WebApplicationFactory<Program> _api;

    public ConcurrentWriteTests(PostgresFixture db)
    {
        _db = db;
        _api = new WebApplicationFactory<Program>().WithWebHostBuilder(builder =>
        {
            builder.UseEnvironment("Testing");
            builder.UseSetting("ConnectionStrings:DefaultConnection", db.ConnectionString);
            builder.UseSetting("JwtSettings:SecretKey", new string('k', 64));
            builder.UseSetting("Redis:Enabled", "false");
            builder.UseSetting("S3:BucketName", "concurrent-writes");
        });
    }

    public void Dispose() => _api.Dispose();

    private async Task<T> SendAsync<T>(IRequest<T> request)
    {
        using var scope = _api.Services.CreateScope();
        return await scope.ServiceProvider.GetRequiredService<IMediator>().Send(request);
    }

    /// <summary>Runs <paramref name="count"/> copies at once; each either returns or throws, and both are kept.</summary>
    private static async Task<List<(T? Value, Exception? Error)>> RaceAsync<T>(int count, Func<Task<T>> run)
    {
        using var start = new SemaphoreSlim(0);
        var tasks = Enumerable.Range(0, count).Select(async _ =>
        {
            await start.WaitAsync();
            try { return ((T?)await run(), (Exception?)null); }
            catch (Exception ex) { return (default, ex); }
        }).ToList();
        start.Release(count);
        return (await Task.WhenAll(tasks)).ToList();
    }

    private async Task<(Guid UserId, Guid CardId)> UserWithCardAsync()
    {
        var now = DateTime.UtcNow;
        var userId = Guid.NewGuid();
        var courseId = Guid.NewGuid();
        var documentId = Guid.NewGuid();
        var cardId = Guid.NewGuid();
        await using var seed = _db.NewContext();
        seed.Users.Add(new User { UserId = userId, Email = $"{userId:N}@example.com", FullName = "C", PasswordHash = "x", CreatedAt = now, UpdatedAt = now });
        seed.Courses.Add(new Course { CourseId = courseId, UserId = userId, CourseName = "C", CreatedAt = now, UpdatedAt = now });
        seed.Documents.Add(new Document { DocumentId = documentId, UserId = userId, CourseId = courseId, FileName = "d.pdf", BlobUrl = "b", ContentType = "application/pdf", CreatedAt = now, UpdatedAt = now });
        seed.Flashcards.Add(new Flashcard { FlashcardId = cardId, UserId = userId, DocumentId = documentId, Front = "Q", Back = "A", CreatedAt = now, UpdatedAt = now });
        await seed.SaveChangesAsync();
        return (userId, cardId);
    }

    private static void AssertOnlyConflicts<T>(IEnumerable<(T? Value, Exception? Error)> results)
        => Assert.All(results.Where(r => r.Error != null), r => Assert.IsType<ConcurrencyConflictException>(r.Error));

    [DockerFact]
    public async Task DoubleTappedFirstReview_OfANewCard_IsRecordedOnce()
    {
        // Neither request finds an SRS row, so both insert one; the (UserId, FlashcardId) unique index
        // decides, and the loser's review log rolls back with it.
        var (userId, cardId) = await UserWithCardAsync();

        var results = await RaceAsync(4, () => SendAsync(new ReviewFlashcardCommand(cardId, userId, Rating: 3)));

        Assert.Contains(results, r => r.Value?.IsSuccess == true);
        AssertOnlyConflicts(results);
        await using var check = _db.NewContext();
        Assert.Equal(1, await check.FlashcardSrs.CountAsync(s => s.FlashcardId == cardId));
        var succeeded = results.Count(r => r.Value?.IsSuccess == true);
        Assert.Equal(succeeded, await check.FlashcardReviewLogs.CountAsync(l => l.FlashcardId == cardId));
        Assert.Equal(succeeded, (await check.FlashcardSrs.SingleAsync(s => s.FlashcardId == cardId)).Reps);
    }

    [DockerFact]
    public async Task SimultaneousReviews_OfAReviewedCard_NeverDoubleCount()
    {
        // Both load the same row; the xmin row version lets only the first save through, so the card is
        // never scheduled from a review the other request did not see.
        var (userId, cardId) = await UserWithCardAsync();
        Assert.True((await SendAsync(new ReviewFlashcardCommand(cardId, userId, Rating: 3))).IsSuccess);

        var results = await RaceAsync(4, () => SendAsync(new ReviewFlashcardCommand(cardId, userId, Rating: 4)));

        AssertOnlyConflicts(results);
        var succeeded = results.Count(r => r.Value?.IsSuccess == true);
        Assert.InRange(succeeded, 1, 4);
        await using var check = _db.NewContext();
        var srs = await check.FlashcardSrs.SingleAsync(s => s.FlashcardId == cardId);
        Assert.Equal(1 + succeeded, srs.Reps);
        Assert.Equal(1 + succeeded, await check.FlashcardReviewLogs.CountAsync(l => l.FlashcardId == cardId));
    }

    [DockerFact]
    public async Task DoubleSubmittedJoin_LeavesOneMembership()
    {
        var (ownerId, _) = await UserWithCardAsync();
        var (joinerId, _) = await UserWithCardAsync();
        var group = await SendAsync(new CreateStudyGroupCommand(ownerId, "G", null));
        var inviteCode = group.Data!.InviteCode;

        var results = await RaceAsync(4, () => SendAsync(new JoinStudyGroupCommand(joinerId, inviteCode)));

        AssertOnlyConflicts(results);
        Assert.All(results.Where(r => r.Value is { IsSuccess: false }), r => Assert.Equal("ALREADY_MEMBER", r.Value!.ErrorCode));
        await using var check = _db.NewContext();
        Assert.Equal(1, await check.StudyGroupMembers.CountAsync(m => m.UserId == joinerId));
    }
}
