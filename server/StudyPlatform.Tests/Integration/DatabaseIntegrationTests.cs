using Microsoft.EntityFrameworkCore;
using StudyPlatform.Domain.Entities;
using StudyPlatform.Infrastructure.Repositories;
using Xunit;

namespace StudyPlatform.Tests.Integration;

// Behaviour that only a real Postgres can show: SQL the mocks never run, constraints, ON CONFLICT.
[Collection(PostgresCollection.Name)]
public class DatabaseIntegrationTests
{
    private readonly PostgresFixture _db;

    public DatabaseIntegrationTests(PostgresFixture db) => _db = db;

    private async Task<User> NewUserAsync()
    {
        await using var context = _db.NewContext();
        var user = new User
        {
            UserId = Guid.NewGuid(),
            Email = $"{Guid.NewGuid():N}@example.com",
            FullName = "Test",
            PasswordHash = "x",
            TimeZone = "Pacific/Auckland",
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
        };
        context.Users.Add(user);
        await context.SaveChangesAsync();
        return user;
    }

    [DockerFact]
    public async Task AllMigrations_ApplyToAnEmptyPgvectorDatabase()
    {
        await using var context = _db.NewContext();

        Assert.Empty(await context.Database.GetPendingMigrationsAsync());
        Assert.Equal(context.Database.GetMigrations(), await context.Database.GetAppliedMigrationsAsync());
    }

    [DockerFact]
    public async Task UserTimeZone_RoundTrips()
    {
        var user = await NewUserAsync();
        await using var context = _db.NewContext();

        Assert.Equal("Pacific/Auckland", (await context.Users.SingleAsync(u => u.UserId == user.UserId)).TimeZone);
    }

    [DockerFact]
    public async Task FreezeDays_FromConcurrentDashboardLoads_AreInsertedOnce()
    {
        var user = await NewUserAsync();
        var days = new[] { new DateTime(2026, 10, 10, 0, 0, 0, DateTimeKind.Utc), new DateTime(2026, 10, 11, 0, 0, 0, DateTimeKind.Utc) };

        // Eight "tabs" at once, each with its own context, as concurrent requests would be.
        var added = await Task.WhenAll(Enumerable.Range(0, 8).Select(async _ =>
        {
            await using var context = _db.NewContext();
            return await new StreakCoverDayRepository(context).AddFreezeDaysAsync(user.UserId, days);
        }));

        Assert.Equal(2, added.Sum()); // no unique-index violation, and each day counted once in total
        await using var check = _db.NewContext();
        Assert.Equal(2, await check.StreakCoverDays.CountAsync(c => c.UserId == user.UserId));
    }

    [DockerFact]
    public async Task GlossaryRegenerate_DeletesOnlyTheCallersTermsForTheVideo()
    {
        var owner = await NewUserAsync();
        var member = await NewUserAsync();
        var videoId = Guid.NewGuid();
        await using (var seed = _db.NewContext())
        {
            var course = new Course { CourseId = Guid.NewGuid(), UserId = owner.UserId, CourseName = "C", CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow };
            seed.Courses.Add(course);
            seed.Videos.Add(new Video
            {
                VideoId = videoId, UserId = owner.UserId, CourseId = course.CourseId, ExternalVideoId = "abc",
                VideoUrl = "https://youtu.be/abc", SourceType = "youtube", Title = "T", ThumbnailUrl = "",
                CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow,
            });
            foreach (var userId in new[] { owner.UserId, member.UserId })
                seed.GlossaryTerms.Add(new GlossaryTerm
                {
                    GlossaryTermId = Guid.NewGuid(), UserId = userId, VideoId = videoId, Term = "t", Definition = "d", CreatedAt = DateTime.UtcNow,
                });
            await seed.SaveChangesAsync();
        }

        await using (var context = _db.NewContext())
        {
            await new GlossaryTermRepository(context).DeleteByVideoIdAsync(videoId, member.UserId);
            await context.SaveChangesAsync();
        }

        await using var check = _db.NewContext();
        var remaining = await check.GlossaryTerms.Where(t => t.VideoId == videoId).Select(t => t.UserId).ToListAsync();
        Assert.Equal([owner.UserId], remaining);
    }

    [DockerFact]
    public async Task Paging_WithHostileInput_StillReturnsAPage()
    {
        var user = await NewUserAsync();
        await using var context = _db.NewContext();

        // page=0 used to reach Postgres as a negative OFFSET and fail the request.
        var (items, _) = await new VideoRepository(context).GetPagedLiteAsync(user.UserId, page: 0, pageSize: -3);

        Assert.Empty(items);
    }
}
