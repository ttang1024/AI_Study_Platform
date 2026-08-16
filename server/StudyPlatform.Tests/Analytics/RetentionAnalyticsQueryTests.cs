using Moq;
using StudyPlatform.Application.Analytics.Queries;
using StudyPlatform.Domain.Entities;
using StudyPlatform.Domain.Interfaces;
using Xunit;

namespace StudyPlatform.Tests.Analytics;

public class GetRetentionAnalyticsQueryHandlerTests
{
    private readonly Mock<IUnitOfWork> _uow = new();
    private readonly Mock<IFlashcardSrsDataRepository> _srs = new();
    private readonly Mock<IFlashcardReviewLogRepository> _logs = new();
    private readonly GetRetentionAnalyticsQueryHandler _handler;
    private readonly Guid _userId = Guid.NewGuid();

    public GetRetentionAnalyticsQueryHandlerTests()
    {
        _uow.Setup(u => u.FlashcardSrs).Returns(_srs.Object);
        _uow.Setup(u => u.FlashcardReviewLogs).Returns(_logs.Object);
        _srs.Setup(r => r.GetByUserIdAsync(_userId, default)).ReturnsAsync(Array.Empty<FlashcardSrsData>());
        _logs.Setup(r => r.GetByUserAsync(_userId, null, default)).ReturnsAsync(Array.Empty<FlashcardReviewLog>());
        _handler = new GetRetentionAnalyticsQueryHandler(_uow.Object);
    }

    [Fact]
    public async Task Handle_NoData_ReturnsZeroedDto()
    {
        var result = await _handler.Handle(new GetRetentionAnalyticsQuery(_userId), default);

        Assert.True(result.IsSuccess);
        Assert.Equal(0, result.Data!.TotalCardsTracked);
        Assert.Equal(0, result.Data.TotalReviews);
        Assert.Equal(0, result.Data.PredictedRetentionNow);
        Assert.Equal(0, result.Data.ActualRetentionRate);
        Assert.Equal(12, result.Data.ForgettingCurve.Count);
        Assert.Empty(result.Data.Calibration);
        Assert.Empty(result.Data.DailyReviews);
        Assert.Equal(5, result.Data.StabilityDistribution.Count);
    }

    [Fact]
    public async Task Handle_NewStateCards_AreExcludedFromTracking()
    {
        _srs.Setup(r => r.GetByUserIdAsync(_userId, default)).ReturnsAsync(new[]
        {
            new FlashcardSrsData { Id = Guid.NewGuid(), UserId = _userId, FlashcardId = Guid.NewGuid(), State = 0, Stability = 5 },
        });

        var result = await _handler.Handle(new GetRetentionAnalyticsQuery(_userId), default);

        Assert.Equal(0, result.Data!.TotalCardsTracked);
    }

    [Fact]
    public async Task Handle_ZeroStabilityCards_AreExcluded()
    {
        _srs.Setup(r => r.GetByUserIdAsync(_userId, default)).ReturnsAsync(new[]
        {
            new FlashcardSrsData { Id = Guid.NewGuid(), UserId = _userId, FlashcardId = Guid.NewGuid(), State = 2, Stability = 0 },
        });

        var result = await _handler.Handle(new GetRetentionAnalyticsQuery(_userId), default);

        Assert.Equal(0, result.Data!.TotalCardsTracked);
    }

    [Fact]
    public async Task Handle_TracksReviewCardsAndComputesAverages()
    {
        _srs.Setup(r => r.GetByUserIdAsync(_userId, default)).ReturnsAsync(new[]
        {
            new FlashcardSrsData { Id = Guid.NewGuid(), UserId = _userId, FlashcardId = Guid.NewGuid(), State = 2, Stability = 10, Difficulty = 5, LastReview = DateTime.UtcNow.AddDays(-2) },
            new FlashcardSrsData { Id = Guid.NewGuid(), UserId = _userId, FlashcardId = Guid.NewGuid(), State = 2, Stability = 20, Difficulty = 3, LastReview = DateTime.UtcNow.AddDays(-1) },
        });

        var result = await _handler.Handle(new GetRetentionAnalyticsQuery(_userId), default);

        Assert.Equal(2, result.Data!.TotalCardsTracked);
        Assert.Equal(15, result.Data.AverageStability);
        Assert.Equal(4, result.Data.AverageDifficulty);
    }

    [Fact]
    public async Task Handle_NewCardReviews_AreExcludedFromRecallRate()
    {
        _logs.Setup(r => r.GetByUserAsync(_userId, null, default)).ReturnsAsync(new[]
        {
            new FlashcardReviewLog { Id = Guid.NewGuid(), UserId = _userId, FlashcardId = Guid.NewGuid(), StateBefore = 0, Rating = 1, ReviewedAt = DateTime.UtcNow },
        });

        var result = await _handler.Handle(new GetRetentionAnalyticsQuery(_userId), default);

        Assert.Equal(0, result.Data!.ActualRetentionRate);
        Assert.Equal(1, result.Data.TotalReviews); // still counted in the raw total
    }

    [Fact]
    public async Task Handle_RatingHardOrBetter_CountsAsRecalled()
    {
        _logs.Setup(r => r.GetByUserAsync(_userId, null, default)).ReturnsAsync(new[]
        {
            new FlashcardReviewLog { Id = Guid.NewGuid(), UserId = _userId, FlashcardId = Guid.NewGuid(), StateBefore = 2, Rating = 2, ReviewedAt = DateTime.UtcNow },
            new FlashcardReviewLog { Id = Guid.NewGuid(), UserId = _userId, FlashcardId = Guid.NewGuid(), StateBefore = 2, Rating = 1, ReviewedAt = DateTime.UtcNow },
        });

        var result = await _handler.Handle(new GetRetentionAnalyticsQuery(_userId), default);

        Assert.Equal(0.5, result.Data!.ActualRetentionRate);
    }

    [Fact]
    public async Task Handle_ReviewsOlderThan30Days_ExcludedFromRecentCount()
    {
        _logs.Setup(r => r.GetByUserAsync(_userId, null, default)).ReturnsAsync(new[]
        {
            new FlashcardReviewLog { Id = Guid.NewGuid(), UserId = _userId, FlashcardId = Guid.NewGuid(), StateBefore = 2, Rating = 3, ReviewedAt = DateTime.UtcNow.AddDays(-60) },
        });

        var result = await _handler.Handle(new GetRetentionAnalyticsQuery(_userId), default);

        Assert.Equal(1, result.Data!.TotalReviews);
        Assert.Equal(0, result.Data.ReviewsLast30Days);
        Assert.Empty(result.Data.DailyReviews);
    }

    [Fact]
    public async Task Handle_StabilityBucketsGroupCardsCorrectly()
    {
        _srs.Setup(r => r.GetByUserIdAsync(_userId, default)).ReturnsAsync(new[]
        {
            new FlashcardSrsData { Id = Guid.NewGuid(), UserId = _userId, FlashcardId = Guid.NewGuid(), State = 2, Stability = 0.5 },
            new FlashcardSrsData { Id = Guid.NewGuid(), UserId = _userId, FlashcardId = Guid.NewGuid(), State = 2, Stability = 100 },
        });

        var result = await _handler.Handle(new GetRetentionAnalyticsQuery(_userId), default);

        Assert.Equal(1, result.Data!.StabilityDistribution.Single(b => b.Label == "< 1 day").Cards);
        Assert.Equal(1, result.Data.StabilityDistribution.Single(b => b.Label == "3+ months").Cards);
    }
}
