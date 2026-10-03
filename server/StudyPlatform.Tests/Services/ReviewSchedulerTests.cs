using Moq;
using StudyPlatform.Application.Services;
using StudyPlatform.Domain.Entities;
using StudyPlatform.Domain.Interfaces;
using Xunit;

namespace StudyPlatform.Tests.Services;

public class ReviewSchedulerTests
{
    private readonly Mock<IUnitOfWork> _uow = new();
    private readonly Mock<IUserFsrsSettingsRepository> _settings = new();
    private readonly Mock<IFlashcardSrsDataRepository> _srsRepo = new();
    private readonly ReviewScheduler _scheduler;

    private readonly Guid _userId = Guid.NewGuid();
    private static readonly DateTime ReviewedAt = new(2026, 6, 1, 9, 0, 0, DateTimeKind.Utc);
    private static readonly DateTime Today = new(2026, 6, 1, 0, 0, 0, DateTimeKind.Utc);

    public ReviewSchedulerTests()
    {
        _uow.Setup(u => u.UserFsrsSettings).Returns(_settings.Object);
        _uow.Setup(u => u.FlashcardSrs).Returns(_srsRepo.Object);
        _settings.Setup(r => r.GetByUserIdAsync(_userId, default)).ReturnsAsync((UserFsrsSettings?)null);
        DueCounts([]);
        _scheduler = new ReviewScheduler(_uow.Object);
    }

    private void DueCounts(Dictionary<DateTime, int> counts) =>
        _srsRepo.Setup(r => r.GetDueCountsByDayAsync(_userId, It.IsAny<DateTime>(), It.IsAny<DateTime>(), default))
            .ReturnsAsync(counts);

    private void Settings(UserFsrsSettings settings) =>
        _settings.Setup(r => r.GetByUserIdAsync(_userId, default)).ReturnsAsync(settings);

    private static FlashcardSrsData ReviewCard(double stability = 30, Guid? cardId = null) => new()
    {
        Id = Guid.NewGuid(),
        FlashcardId = cardId ?? Guid.NewGuid(),
        State = 2,
        Stability = stability,
        Difficulty = 5,
        Reps = 4,
        LastReview = ReviewedAt.AddDays(-30),
    };

    [Fact]
    public async Task Schedule_WithFuzzOff_LeavesTheIntervalWhereFsrsPutIt()
    {
        Settings(new UserFsrsSettings { EnableFuzz = false });

        var result = await _scheduler.ScheduleAsync(ReviewCard(), 3, ReviewedAt, _userId);

        Assert.Equal((int)Math.Round(result.Stability), result.ScheduledDays);
        _srsRepo.Verify(
            r => r.GetDueCountsByDayAsync(It.IsAny<Guid>(), It.IsAny<DateTime>(), It.IsAny<DateTime>(), default),
            Times.Never);
    }

    [Fact]
    public async Task Schedule_StaysInsideTheFuzzBand()
    {
        var card = ReviewCard();
        var unspread = FsrsService.Review(card, 3, ReviewedAt, FsrsParameters.Default);
        var (min, max) = FsrsService.FuzzRange(unspread.ScheduledDays);

        var result = await _scheduler.ScheduleAsync(card, 3, ReviewedAt, _userId);

        Assert.InRange(result.ScheduledDays, min, max);
    }

    [Fact]
    public async Task Schedule_AvoidsTheDaysThatAreAlreadyBusy()
    {
        var card = ReviewCard();
        var unspread = FsrsService.Review(card, 3, ReviewedAt, FsrsParameters.Default);
        var (min, max) = FsrsService.FuzzRange(unspread.ScheduledDays);

        // Every day in the band is loaded except one; the scheduler must find it.
        var quiet = min + 2;
        var counts = new Dictionary<DateTime, int>();
        for (var d = min; d <= max; d++)
            if (d != quiet) counts[Today.AddDays(d)] = 500;
        DueCounts(counts);

        var result = await _scheduler.ScheduleAsync(card, 3, ReviewedAt, _userId);

        Assert.Equal(quiet, result.ScheduledDays);
        Assert.Equal(Today.AddDays(quiet), result.Due);
    }

    [Fact]
    public async Task Schedule_WithFlatLoad_FallsBackToScattering()
    {
        var card = ReviewCard();
        var unspread = FsrsService.Review(card, 3, ReviewedAt, FsrsParameters.Default);
        var (min, max) = FsrsService.FuzzRange(unspread.ScheduledDays);

        // Every day equally loaded, so the counts carry no signal about where to go. That is
        // exactly the case blind fuzz is for, and it must not collapse onto one day.
        var counts = new Dictionary<DateTime, int>();
        for (var d = min; d <= max; d++) counts[Today.AddDays(d)] = 7;
        DueCounts(counts);

        var result = await _scheduler.ScheduleAsync(card, 3, ReviewedAt, _userId);

        Assert.Equal(FsrsService.ApplyFuzz(unspread.ScheduledDays, card.FlashcardId), result.ScheduledDays);
    }

    [Fact]
    public async Task Schedule_NeverExceedsTheMaximumInterval()
    {
        Settings(new UserFsrsSettings { EnableFuzz = true, MaximumIntervalDays = 40 });

        var result = await _scheduler.ScheduleAsync(ReviewCard(stability: 400), 4, ReviewedAt, _userId);

        Assert.True(result.ScheduledDays <= 40, $"scheduled {result.ScheduledDays} days past a 40-day cap");
    }

    [Fact]
    public async Task Schedule_ShortIntervalsAreNotSpread()
    {
        // An "Again" goes to one day; there is no band to search and no query worth making.
        var result = await _scheduler.ScheduleAsync(ReviewCard(), 1, ReviewedAt, _userId);

        Assert.Equal(1, result.ScheduledDays);
        _srsRepo.Verify(
            r => r.GetDueCountsByDayAsync(It.IsAny<Guid>(), It.IsAny<DateTime>(), It.IsAny<DateTime>(), default),
            Times.Never);
    }

    [Fact]
    public async Task Schedule_UsesTheUsersOwnRetention()
    {
        Settings(new UserFsrsSettings { EnableFuzz = false, DesiredRetention = 0.80 });

        var result = await _scheduler.ScheduleAsync(ReviewCard(), 3, ReviewedAt, _userId);

        // Aiming lower than 0.9 always schedules further out than the stability itself.
        Assert.True(result.ScheduledDays > (int)Math.Round(result.Stability));
    }

    [Fact]
    public async Task Schedule_IsDeterministicForTheSameCard()
    {
        var cardId = Guid.NewGuid();

        var first = await _scheduler.ScheduleAsync(ReviewCard(cardId: cardId), 3, ReviewedAt, _userId);
        var second = await _scheduler.ScheduleAsync(ReviewCard(cardId: cardId), 3, ReviewedAt, _userId);

        Assert.Equal(first.ScheduledDays, second.ScheduledDays);
    }

    [Fact]
    public void PickQuietestDay_WithAnEmptyBand_StillScattersCards()
    {
        // No load anywhere: the tie-break must not collapse every card onto the same day, or
        // spreading would do nothing precisely when the calendar is empty.
        var chosen = Enumerable.Range(0, 200)
            .Select(_ => ReviewScheduler.PickQuietestDay(28, 32, 30, Today, new Dictionary<DateTime, int>(), Guid.NewGuid()))
            .Distinct()
            .Count();

        Assert.True(chosen > 1, "every card landed on the same day");
    }
}
