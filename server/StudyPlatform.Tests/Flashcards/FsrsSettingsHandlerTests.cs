using System.Linq.Expressions;
using Moq;
using StudyPlatform.Application.Flashcards.Commands;
using StudyPlatform.Application.Services;
using StudyPlatform.Domain.Entities;
using StudyPlatform.Domain.Interfaces;
using StudyPlatform.Tests.TestSupport;
using Xunit;

namespace StudyPlatform.Tests.Flashcards;

public class FsrsSettingsHandlerTests
{
    private readonly Mock<IUnitOfWork> _uow = new();
    private readonly Mock<IUserFsrsSettingsRepository> _settings = new();
    private readonly Mock<IFlashcardReviewLogRepository> _reviewLogs = new();
    private readonly Guid _userId = Guid.NewGuid();

    public FsrsSettingsHandlerTests()
    {
        _uow.Setup(u => u.UserFsrsSettings).Returns(_settings.Object);
        _uow.Setup(u => u.FlashcardReviewLogs).Returns(_reviewLogs.Object);
        _uow.Setup(u => u.SaveChangesAsync(default)).ReturnsAsync(1);
        _settings.Setup(r => r.AddAsync(It.IsAny<UserFsrsSettings>(), default)).Returns(Task.CompletedTask);
        _reviewLogs.Setup(r => r.CountAsync(It.IsAny<Expression<Func<FlashcardReviewLog, bool>>>(), default))
            .ReturnsAsync(0);
    }

    [Fact]
    public async Task Get_WithoutRow_ReturnsDefaultsWithoutWriting()
    {
        _settings.Setup(r => r.GetByUserIdAsync(_userId, default)).ReturnsAsync((UserFsrsSettings?)null);
        var handler = new GetFsrsSettingsQueryHandler(_uow.Object);

        var result = await handler.Handle(new GetFsrsSettingsQuery(_userId), default);

        Assert.True(result.IsSuccess);
        Assert.Equal(FsrsParameters.DefaultRetention, result.Data!.DesiredRetention);
        Assert.False(result.Data.UsingOptimizedWeights);
        Assert.Equal(FsrsOptimizer.MinimumReviews, result.Data.MinimumReviewsToOptimize);
        _settings.Verify(r => r.AddAsync(It.IsAny<UserFsrsSettings>(), default), Times.Never);
        _uow.Verify(u => u.SaveChangesAsync(default), Times.Never);
    }

    [Fact]
    public async Task Get_ReportsReviewCountForTheOptimizerGate()
    {
        _settings.Setup(r => r.GetByUserIdAsync(_userId, default)).ReturnsAsync((UserFsrsSettings?)null);
        _reviewLogs.Setup(r => r.CountAsync(It.IsAny<Expression<Func<FlashcardReviewLog, bool>>>(), default))
            .ReturnsAsync(742);
        var handler = new GetFsrsSettingsQueryHandler(_uow.Object);

        var result = await handler.Handle(new GetFsrsSettingsQuery(_userId), default);

        Assert.Equal(742, result.Data!.ReviewCount);
    }

    [Fact]
    public async Task Update_WithoutRow_CreatesOne()
    {
        _settings.Setup(r => r.GetByUserIdAsync(_userId, default)).ReturnsAsync((UserFsrsSettings?)null);
        var handler = new UpdateFsrsSettingsCommandHandler(_uow.Object);

        var result = await handler.Handle(new UpdateFsrsSettingsCommand(_userId, DesiredRetention: 0.85), default);

        Assert.True(result.IsSuccess);
        Assert.Equal(0.85, result.Data!.DesiredRetention);
        _settings.Verify(r => r.AddAsync(It.IsAny<UserFsrsSettings>(), default), Times.Once);
        _uow.Verify(u => u.SaveChangesAsync(default), Times.Once);
    }

    [Fact]
    public async Task Update_LeavesOmittedFieldsAlone()
    {
        var existing = Existing(retention: 0.85, maxInterval: 180, fuzz: false);
        var handler = new UpdateFsrsSettingsCommandHandler(_uow.Object);

        var result = await handler.Handle(new UpdateFsrsSettingsCommand(_userId, EnableFuzz: true), default);

        Assert.True(result.IsSuccess);
        Assert.Equal(0.85, existing.DesiredRetention);
        Assert.Equal(180, existing.MaximumIntervalDays);
        Assert.True(existing.EnableFuzz);
    }

    [Theory]
    [InlineData(0.5)]
    [InlineData(0.995)]
    public async Task Update_RejectsRetentionOutsideSupportedRange(double retention)
    {
        Existing();
        var handler = new UpdateFsrsSettingsCommandHandler(_uow.Object);

        var result = await handler.Handle(new UpdateFsrsSettingsCommand(_userId, DesiredRetention: retention), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("INVALID_RETENTION", result.ErrorCode);
        _uow.Verify(u => u.SaveChangesAsync(default), Times.Never);
    }

    [Theory]
    [InlineData(0)]
    [InlineData(100_000)]
    public async Task Update_RejectsUnusableMaximumInterval(int days)
    {
        Existing();
        var handler = new UpdateFsrsSettingsCommandHandler(_uow.Object);

        var result = await handler.Handle(new UpdateFsrsSettingsCommand(_userId, MaximumIntervalDays: days), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("INVALID_MAX_INTERVAL", result.ErrorCode);
    }

    [Theory]
    [InlineData(-1)]
    [InlineData(10_000)]
    public async Task Update_RejectsAnUnusableNewCardLimit(int perDay)
    {
        Existing();
        var handler = new UpdateFsrsSettingsCommandHandler(_uow.Object);

        var result = await handler.Handle(new UpdateFsrsSettingsCommand(_userId, NewCardsPerDay: perDay), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("INVALID_NEW_LIMIT", result.ErrorCode);
        _uow.Verify(u => u.SaveChangesAsync(default), Times.Never);
    }

    [Theory]
    [InlineData(-1)]
    [InlineData(10_000)]
    public async Task Update_RejectsAnUnusableReviewLimit(int perDay)
    {
        Existing();
        var handler = new UpdateFsrsSettingsCommandHandler(_uow.Object);

        var result = await handler.Handle(new UpdateFsrsSettingsCommand(_userId, MaxReviewsPerDay: perDay), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("INVALID_REVIEW_LIMIT", result.ErrorCode);
    }

    [Fact]
    public async Task Update_ZeroReviewsPerDay_MeansNoLimit()
    {
        var existing = Existing();
        existing.MaxReviewsPerDay = 40;
        var handler = new UpdateFsrsSettingsCommandHandler(_uow.Object);

        var result = await handler.Handle(new UpdateFsrsSettingsCommand(_userId, MaxReviewsPerDay: 0), default);

        Assert.True(result.IsSuccess);
        Assert.Equal(0, result.Data!.MaxReviewsPerDay);
    }

    [Fact]
    public async Task Get_WithoutRow_ReportsTheNewCardDefaultBothClientsUsed()
    {
        _settings.Setup(r => r.GetByUserIdAsync(_userId, default)).ReturnsAsync((UserFsrsSettings?)null);
        var handler = new GetFsrsSettingsQueryHandler(_uow.Object);

        var result = await handler.Handle(new GetFsrsSettingsQuery(_userId), default);

        Assert.Equal(FsrsParameters.DefaultNewCardsPerDay, result.Data!.NewCardsPerDay);
        Assert.Equal(0, result.Data.MaxReviewsPerDay);
    }

    [Fact]
    public async Task Optimize_WithThinHistory_FailsWithoutWriting()
    {
        Existing();
        _reviewLogs.Setup(r => r.GetByUserAsync(_userId, null, default)).ReturnsAsync([]);
        var handler = new OptimizeFsrsWeightsCommandHandler(_uow.Object, new FsrsOptimizer());

        var result = await handler.Handle(new OptimizeFsrsWeightsCommand(_userId), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("NOT_ENOUGH_REVIEWS", result.ErrorCode);
        _uow.Verify(u => u.SaveChangesAsync(default), Times.Never);
    }

    [Fact]
    public async Task Optimize_StoresFittedWeightsAndMetrics()
    {
        var existing = Existing();
        _reviewLogs.Setup(r => r.GetByUserAsync(_userId, null, default)).ReturnsAsync(ReviewHistory.Durable(_userId));
        var handler = new OptimizeFsrsWeightsCommandHandler(_uow.Object, new FsrsOptimizer());

        var result = await handler.Handle(new OptimizeFsrsWeightsCommand(_userId), default);

        Assert.True(result.IsSuccess);
        Assert.True(result.Data!.Applied);
        Assert.NotNull(existing.WeightsJson);
        Assert.Equal(result.Data.Weights, FsrsParameters.ParseWeights(existing.WeightsJson));
        Assert.NotNull(existing.WeightsOptimizedAt);
        Assert.Equal(result.Data.ReviewCount, existing.ReviewsAtOptimization);
        Assert.Equal(result.Data.LogLossAfter, existing.LogLossAfter);
        _uow.Verify(u => u.SaveChangesAsync(default), Times.Once);
    }

    [Fact]
    public async Task Optimize_FitsFromStockWeightsNotThePreviousFit()
    {
        // Re-optimizing on top of an earlier fit compounds its errors and makes the reported
        // "before" number meaningless, so a second run must start from the defaults again.
        var existing = Existing();
        var previousFit = (double[])FsrsParameters.DefaultWeights.Clone();
        previousFit[0] = 0.05;
        existing.WeightsJson = FsrsParameters.Serialize(previousFit);

        var logs = ReviewHistory.Durable(_userId);
        _reviewLogs.Setup(r => r.GetByUserAsync(_userId, null, default)).ReturnsAsync(logs);
        var handler = new OptimizeFsrsWeightsCommandHandler(_uow.Object, new FsrsOptimizer());

        var result = await handler.Handle(new OptimizeFsrsWeightsCommand(_userId), default);

        var fromStock = new FsrsOptimizer().Optimize(logs, FsrsParameters.DefaultWeights);
        Assert.Equal(fromStock!.LogLossBefore, result.Data!.LogLossBefore);
    }

    [Fact]
    public async Task Reset_ClearsFittedWeightsButKeepsPreferences()
    {
        var existing = Existing(retention: 0.85, maxInterval: 180, fuzz: false);
        existing.WeightsJson = FsrsParameters.Serialize(FsrsParameters.DefaultWeights);
        existing.WeightsOptimizedAt = DateTime.UtcNow;
        existing.ReviewsAtOptimization = 900;
        existing.LogLossBefore = 0.5;
        existing.LogLossAfter = 0.4;
        var handler = new ResetFsrsWeightsCommandHandler(_uow.Object);

        var result = await handler.Handle(new ResetFsrsWeightsCommand(_userId), default);

        Assert.True(result.IsSuccess);
        Assert.Null(existing.WeightsJson);
        Assert.Null(existing.WeightsOptimizedAt);
        Assert.Equal(0, existing.ReviewsAtOptimization);
        Assert.Null(existing.LogLossAfter);
        Assert.Equal(0.85, existing.DesiredRetention);
        Assert.Equal(180, existing.MaximumIntervalDays);
        Assert.False(result.Data!.UsingOptimizedWeights);
    }

    [Fact]
    public async Task Reset_WithoutRow_IsANoOp()
    {
        _settings.Setup(r => r.GetByUserIdAsync(_userId, default)).ReturnsAsync((UserFsrsSettings?)null);
        var handler = new ResetFsrsWeightsCommandHandler(_uow.Object);

        var result = await handler.Handle(new ResetFsrsWeightsCommand(_userId), default);

        Assert.True(result.IsSuccess);
        _uow.Verify(u => u.SaveChangesAsync(default), Times.Never);
    }

    private UserFsrsSettings Existing(double retention = 0.9, int maxInterval = 36500, bool fuzz = true)
    {
        var settings = new UserFsrsSettings
        {
            Id = Guid.NewGuid(),
            UserId = _userId,
            DesiredRetention = retention,
            MaximumIntervalDays = maxInterval,
            EnableFuzz = fuzz,
        };
        _settings.Setup(r => r.GetByUserIdAsync(_userId, default)).ReturnsAsync(settings);
        return settings;
    }

}
