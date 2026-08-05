using Microsoft.Extensions.Options;
using Moq;
using StudyPlatform.Application.Analytics.DTOs;
using StudyPlatform.Application.Analytics.Queries;
using StudyPlatform.Application.Services;
using StudyPlatform.Application.Settings;
using StudyPlatform.Domain.Entities;
using StudyPlatform.Domain.Interfaces;
using Xunit;

namespace StudyPlatform.Tests.Analytics;

public class ActivityHeatmapQueryTests
{
    private readonly Mock<IUnitOfWork> _uow = new();
    private readonly Mock<IFlashcardReviewLogRepository> _logs = new();
    private readonly Mock<IStudySessionRepository> _sessions = new();
    private readonly GetActivityHeatmapQueryHandler _handler;
    private readonly Guid _userId = Guid.NewGuid();

    public ActivityHeatmapQueryTests()
    {
        _uow.Setup(u => u.FlashcardReviewLogs).Returns(_logs.Object);
        _uow.Setup(u => u.StudySessions).Returns(_sessions.Object);

        var cache = new Mock<IAppCache>();
        cache.Setup(c => c.GetOrCreateAsync(
                It.IsAny<string>(), It.IsAny<Func<CancellationToken, Task<ActivityHeatmapDto>>>(),
                It.IsAny<TimeSpan>(), It.IsAny<CancellationToken>()))
            .Returns((string _, Func<CancellationToken, Task<ActivityHeatmapDto>> factory, TimeSpan _, CancellationToken ct) => factory(ct));

        _handler = new GetActivityHeatmapQueryHandler(_uow.Object, cache.Object, Options.Create(new CacheOptions()));
    }

    private static FlashcardReviewLog Log(DateTime reviewedAt) => new()
    {
        Id = Guid.NewGuid(),
        FlashcardId = Guid.NewGuid(),
        Rating = 3,
        ReviewedAt = reviewedAt,
    };

    private StudySession Session(DateTime occurredAt, int seconds) => new()
    {
        StudySessionId = Guid.NewGuid(),
        UserId = _userId,
        ContextType = "general",
        DurationSeconds = seconds,
        OccurredAt = occurredAt,
    };

    [Fact]
    public async Task Handle_MergesReviewsAndStudyTimePerDay()
    {
        var today = DateTime.UtcNow.Date;
        var yesterday = today.AddDays(-1);

        _logs.Setup(r => r.GetByUserAsync(_userId, It.IsAny<DateTime?>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new[] { Log(today.AddHours(9)), Log(today.AddHours(10)), Log(yesterday.AddHours(20)) });
        _sessions.Setup(r => r.GetByDateRangeAsync(_userId, It.IsAny<DateTime>(), It.IsAny<DateTime>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new[] { Session(today.AddHours(9), 600), Session(today.AddHours(11), 300) });

        var result = await _handler.Handle(new GetActivityHeatmapQuery(_userId), default);

        Assert.True(result.IsSuccess);
        var dto = result.Data!;
        Assert.Equal(2, dto.Days.Count);
        Assert.Equal(3, dto.TotalReviews);
        Assert.Equal(15, dto.TotalStudyMinutes);
        Assert.Equal(2, dto.ActiveDays);

        var todayDto = dto.Days.Single(d => d.Date == today);
        Assert.Equal(2, todayDto.Reviews);
        Assert.Equal(15, todayDto.StudyMinutes);

        var yesterdayDto = dto.Days.Single(d => d.Date == yesterday);
        Assert.Equal(1, yesterdayDto.Reviews);
        Assert.Equal(0, yesterdayDto.StudyMinutes);
    }

    [Fact]
    public async Task Handle_DayWithOnlyStudyTime_StillAppears()
    {
        var day = DateTime.UtcNow.Date.AddDays(-3);
        _logs.Setup(r => r.GetByUserAsync(_userId, It.IsAny<DateTime?>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(Array.Empty<FlashcardReviewLog>());
        _sessions.Setup(r => r.GetByDateRangeAsync(_userId, It.IsAny<DateTime>(), It.IsAny<DateTime>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new[] { Session(day.AddHours(8), 1200) });

        var result = await _handler.Handle(new GetActivityHeatmapQuery(_userId), default);

        var dayDto = Assert.Single(result.Data!.Days);
        Assert.Equal(day, dayDto.Date);
        Assert.Equal(0, dayDto.Reviews);
        Assert.Equal(20, dayDto.StudyMinutes);
    }

    [Fact]
    public async Task Handle_ClampsRequestedWindow()
    {
        DateTime? since = null;
        _logs.Setup(r => r.GetByUserAsync(_userId, It.IsAny<DateTime?>(), It.IsAny<CancellationToken>()))
            .Callback<Guid, DateTime?, CancellationToken>((_, s, _) => since = s)
            .ReturnsAsync(Array.Empty<FlashcardReviewLog>());
        _sessions.Setup(r => r.GetByDateRangeAsync(_userId, It.IsAny<DateTime>(), It.IsAny<DateTime>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(Array.Empty<StudySession>());

        // 5 days is below the 30-day floor — the window must clamp up to 30 days.
        var result = await _handler.Handle(new GetActivityHeatmapQuery(_userId, Days: 5), default);

        Assert.True(result.IsSuccess);
        Assert.Equal(DateTime.UtcNow.Date.AddDays(-29), since);
        Assert.Equal(result.Data!.From, since);
    }
}
