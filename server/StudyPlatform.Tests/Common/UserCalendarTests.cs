using StudyPlatform.Application.Common;
using Xunit;

namespace StudyPlatform.Tests.Common;

public class UserCalendarTests
{
    private static readonly TimeZoneInfo Auckland = UserCalendar.Resolve("Pacific/Auckland");

    [Fact]
    public void LocalDate_PutsAnAucklandMorningOnTheAucklandDay()
    {
        // 2026-10-11 21:00 UTC is 2026-10-12 10:00 in Auckland (NZDT, UTC+13).
        var date = UserCalendar.LocalDate(new DateTime(2026, 10, 11, 21, 0, 0, DateTimeKind.Utc), Auckland);

        Assert.Equal(new DateTime(2026, 10, 12, 0, 0, 0, DateTimeKind.Utc), date);
        Assert.Equal(DateTimeKind.Utc, date.Kind);
    }

    [Fact]
    public void StartOfDayUtc_IsLocalMidnight()
        => Assert.Equal(
            new DateTime(2026, 10, 11, 11, 0, 0, DateTimeKind.Utc),
            UserCalendar.StartOfDayUtc(new DateTime(2026, 10, 12), Auckland));

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("Not/AZone")]
    public void Resolve_FallsBackToUtc(string? id) => Assert.Equal(TimeZoneInfo.Utc, UserCalendar.Resolve(id));

    [Fact]
    public void IsKnownZone_RejectsOverlongInput() => Assert.False(UserCalendar.IsKnownZone(new string('a', 200)));
}
