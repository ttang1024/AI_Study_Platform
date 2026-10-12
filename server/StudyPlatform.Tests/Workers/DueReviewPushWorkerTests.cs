using StudyPlatform.API.Services;
using Xunit;

namespace StudyPlatform.Tests.Workers;

// Reminders go out in the user's daytime, not the server's.
public class DueReviewPushWorkerTests
{
    // 2026-10-12 14:00 UTC is 03:00 on Oct 13 in Auckland (UTC+13) and 10:00 in New York (UTC-4).
    private static readonly DateTime Now = new(2026, 10, 12, 14, 0, 0, DateTimeKind.Utc);

    [Fact]
    public void SkipsAUserForWhomItIsTheMiddleOfTheNight()
        => Assert.False(DueReviewPushWorker.IsWakingHour(Now, "Pacific/Auckland"));

    [Fact]
    public void RemindsAUserForWhomItIsMorning()
        => Assert.True(DueReviewPushWorker.IsWakingHour(Now, "America/New_York"));

    [Fact]
    public void FallsBackToUtcForAUserWithNoSavedZone()
        => Assert.True(DueReviewPushWorker.IsWakingHour(Now, null));
}
