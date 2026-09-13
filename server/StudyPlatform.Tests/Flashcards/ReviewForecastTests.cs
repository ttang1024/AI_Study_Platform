using Moq;
using StudyPlatform.Application.Flashcards.Commands;
using StudyPlatform.Application.Services;
using StudyPlatform.Domain.Entities;
using StudyPlatform.Domain.Interfaces;
using Xunit;

namespace StudyPlatform.Tests.Flashcards;

public class GetReviewForecastQueryHandlerTests
{
    private readonly Mock<IUnitOfWork> _uow = new();
    private readonly Mock<IFlashcardSrsDataRepository> _srsRepo = new();
    private readonly Mock<IUserFsrsSettingsRepository> _settings = new();
    private readonly GetReviewForecastQueryHandler _handler;
    private readonly Guid _userId = Guid.NewGuid();
    private static readonly DateTime Today = DateTime.SpecifyKind(DateTime.UtcNow.Date, DateTimeKind.Utc);

    public GetReviewForecastQueryHandlerTests()
    {
        _uow.Setup(u => u.FlashcardSrs).Returns(_srsRepo.Object);
        _uow.Setup(u => u.UserFsrsSettings).Returns(_settings.Object);
        _settings.Setup(r => r.GetByUserIdAsync(_userId, default)).ReturnsAsync((UserFsrsSettings?)null);
        _srsRepo.Setup(r => r.GetDueCountsByDayAsync(_userId, It.IsAny<DateTime>(), It.IsAny<DateTime>(), default))
            .ReturnsAsync(new Dictionary<DateTime, int>());
        _srsRepo.Setup(r => r.CountDueByUserIdAsync(_userId, It.IsAny<DateTime>(), default)).ReturnsAsync(0);
        _handler = new GetReviewForecastQueryHandler(_uow.Object);
    }

    [Fact]
    public async Task Handle_ReturnsOneEntryPerDayStartingToday()
    {
        var result = await _handler.Handle(new GetReviewForecastQuery(_userId, 14), default);

        Assert.True(result.IsSuccess);
        Assert.Equal(14, result.Data!.Days.Count);
        Assert.Equal(Today, result.Data.Days[0].Day);
        Assert.Equal(Today.AddDays(13), result.Data.Days[13].Day);
    }

    [Fact]
    public async Task Handle_FillsDaysWithNothingDueAsZero()
    {
        // The repository omits empty days; a chart needs them present, or the bars shift left.
        _srsRepo.Setup(r => r.GetDueCountsByDayAsync(_userId, It.IsAny<DateTime>(), It.IsAny<DateTime>(), default))
            .ReturnsAsync(new Dictionary<DateTime, int> { [Today.AddDays(2)] = 9 });

        var result = await _handler.Handle(new GetReviewForecastQuery(_userId, 5), default);

        Assert.Equal(new[] { 0, 0, 9, 0, 0 }, result.Data!.Days.Select(d => d.Count));
    }

    [Fact]
    public async Task Handle_ReportsOverdueSeparatelyFromTheForwardView()
    {
        _srsRepo.Setup(r => r.CountDueByUserIdAsync(_userId, It.IsAny<DateTime>(), default)).ReturnsAsync(312);

        var result = await _handler.Handle(new GetReviewForecastQuery(_userId), default);

        Assert.Equal(312, result.Data!.Overdue);
    }

    [Theory]
    [InlineData(0, 1)]
    [InlineData(-5, 1)]
    [InlineData(500, GetReviewForecastQuery.MaxDays)]
    public async Task Handle_ClampsTheWindow(int requested, int expected)
    {
        var result = await _handler.Handle(new GetReviewForecastQuery(_userId, requested), default);

        Assert.Equal(expected, result.Data!.Days.Count);
    }

    [Fact]
    public async Task Handle_CarriesTheUsersDailyLimits()
    {
        _settings.Setup(r => r.GetByUserIdAsync(_userId, default))
            .ReturnsAsync(new UserFsrsSettings { NewCardsPerDay = 5, MaxReviewsPerDay = 80 });

        var result = await _handler.Handle(new GetReviewForecastQuery(_userId), default);

        Assert.Equal(5, result.Data!.NewCardsPerDay);
        Assert.Equal(80, result.Data.MaxReviewsPerDay);
    }

    [Fact]
    public async Task Handle_WithoutSettings_ReportsTheShippedDefaults()
    {
        var result = await _handler.Handle(new GetReviewForecastQuery(_userId), default);

        Assert.Equal(FsrsParameters.DefaultNewCardsPerDay, result.Data!.NewCardsPerDay);
        Assert.Equal(0, result.Data.MaxReviewsPerDay);
    }
}

public class RescheduleBacklogCommandHandlerTests
{
    private readonly Mock<IUnitOfWork> _uow = new();
    private readonly Mock<IFlashcardSrsDataRepository> _srsRepo = new();
    private readonly Mock<IUserFsrsSettingsRepository> _settings = new();
    private readonly RescheduleBacklogCommandHandler _handler;
    private readonly Guid _userId = Guid.NewGuid();
    private static readonly DateTime Today = DateTime.SpecifyKind(DateTime.UtcNow.Date, DateTimeKind.Utc);

    public RescheduleBacklogCommandHandlerTests()
    {
        _uow.Setup(u => u.FlashcardSrs).Returns(_srsRepo.Object);
        _uow.Setup(u => u.UserFsrsSettings).Returns(_settings.Object);
        _uow.Setup(u => u.SaveChangesAsync(default)).ReturnsAsync(1);
        _settings.Setup(r => r.GetByUserIdAsync(_userId, default)).ReturnsAsync((UserFsrsSettings?)null);
        _srsRepo.Setup(r => r.GetDueCountsByDayAsync(_userId, It.IsAny<DateTime>(), It.IsAny<DateTime>(), default))
            .ReturnsAsync(new Dictionary<DateTime, int>());
        _handler = new RescheduleBacklogCommandHandler(_uow.Object);
    }

    private List<FlashcardSrsData> Backlog(int count)
    {
        var cards = Enumerable.Range(0, count)
            .Select(i => new FlashcardSrsData
            {
                Id = Guid.NewGuid(),
                UserId = _userId,
                FlashcardId = Guid.NewGuid(),
                State = 2,
                Stability = 20,
                Difficulty = 5,
                Reps = 3,
                Due = Today.AddDays(-(count - i)),
            })
            .ToList();
        _srsRepo.Setup(r => r.GetOverdueByUserIdAsync(_userId, It.IsAny<DateTime>(), default)).ReturnsAsync(cards);
        return cards;
    }

    [Fact]
    public async Task Handle_WithNothingOverdue_DoesNothing()
    {
        Backlog(0);

        var result = await _handler.Handle(new RescheduleBacklogCommand(_userId), default);

        Assert.True(result.IsSuccess);
        Assert.Equal(0, result.Data!.Moved);
        _uow.Verify(u => u.SaveChangesAsync(default), Times.Never);
    }

    [Fact]
    public async Task Handle_SpreadsEvenlyAcrossTheWindow()
    {
        var cards = Backlog(70);

        var result = await _handler.Handle(new RescheduleBacklogCommand(_userId, 7), default);

        Assert.Equal(70, result.Data!.Moved);
        Assert.Equal(10, result.Data.PerDay);
        var perDay = cards.GroupBy(c => c.Due).OrderBy(g => g.Key).ToList();
        Assert.Equal(7, perDay.Count);
        Assert.All(perDay, g => Assert.Equal(10, g.Count()));
    }

    [Fact]
    public async Task Handle_BringsTheLongestWaitingCardsBackFirst()
    {
        var cards = Backlog(20);
        var oldest = cards.First();
        var newest = cards.Last();

        await _handler.Handle(new RescheduleBacklogCommand(_userId, 4), default);

        Assert.True(oldest.Due < newest.Due, "the oldest card was not scheduled before the newest");
    }

    [Fact]
    public async Task Handle_LeavesMemoryStateAlone()
    {
        // Rescheduling moves dates; it must not look like the cards were studied.
        var cards = Backlog(10);
        var before = cards.Select(c => (c.Stability, c.Difficulty, c.State, c.Reps, c.Lapses)).ToList();

        await _handler.Handle(new RescheduleBacklogCommand(_userId, 3), default);

        Assert.Equal(before, cards.Select(c => (c.Stability, c.Difficulty, c.State, c.Reps, c.Lapses)).ToList());
    }

    [Fact]
    public async Task Handle_CountsWhatIsAlreadyScheduledInTheWindow()
    {
        // Day 0 is already full, so the spread should start filling later days instead.
        _srsRepo.Setup(r => r.GetDueCountsByDayAsync(_userId, It.IsAny<DateTime>(), It.IsAny<DateTime>(), default))
            .ReturnsAsync(new Dictionary<DateTime, int> { [Today] = 100 });
        var cards = Backlog(20);

        await _handler.Handle(new RescheduleBacklogCommand(_userId, 4), default);

        Assert.DoesNotContain(cards, c => c.Due == Today);
    }

    [Fact]
    public async Task Handle_RespectsAReviewsPerDayLimit()
    {
        // 100 over 10 days would be 10 a day; the user's ceiling of 5 has to win.
        _settings.Setup(r => r.GetByUserIdAsync(_userId, default))
            .ReturnsAsync(new UserFsrsSettings { MaxReviewsPerDay = 5 });
        var cards = Backlog(100);

        var result = await _handler.Handle(new RescheduleBacklogCommand(_userId, 10), default);

        Assert.Equal(5, result.Data!.PerDay);
        // The last day absorbs the remainder rather than any card being dropped, so the cap is
        // asserted on the days that had somewhere later to push to.
        var byDay = cards.GroupBy(c => c.Due).OrderBy(g => g.Key).ToList();
        Assert.All(byDay.SkipLast(1), g => Assert.True(g.Count() <= 5, $"{g.Count()} cards landed on {g.Key:d}"));
        Assert.Equal(100, cards.Count);
    }

    [Fact]
    public async Task Handle_DoesNotInflateASpreadThatIsAlreadyUnderTheLimit()
    {
        // The limit is a ceiling, not a target: 20 cards over 10 days is 2 a day either way.
        _settings.Setup(r => r.GetByUserIdAsync(_userId, default))
            .ReturnsAsync(new UserFsrsSettings { MaxReviewsPerDay = 50 });
        Backlog(20);

        var result = await _handler.Handle(new RescheduleBacklogCommand(_userId, 10), default);

        Assert.Equal(2, result.Data!.PerDay);
    }

    [Fact]
    public async Task Handle_NeverSchedulesIntoThePast()
    {
        var cards = Backlog(30);

        await _handler.Handle(new RescheduleBacklogCommand(_userId, 5), default);

        Assert.All(cards, c => Assert.True(c.Due >= Today));
    }

    [Theory]
    [InlineData(0)]
    [InlineData(-1)]
    [InlineData(RescheduleBacklogCommand.MaxDays + 1)]
    public async Task Handle_RejectsAnUnusableWindow(int days)
    {
        var result = await _handler.Handle(new RescheduleBacklogCommand(_userId, days), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("INVALID_SPREAD", result.ErrorCode);
        _uow.Verify(u => u.SaveChangesAsync(default), Times.Never);
    }
}
