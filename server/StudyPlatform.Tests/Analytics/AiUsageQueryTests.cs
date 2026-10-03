using Microsoft.Extensions.Options;
using Moq;
using StudyPlatform.Application.Analytics.Queries;
using StudyPlatform.Application.Settings;
using StudyPlatform.Domain.Interfaces;
using Xunit;

namespace StudyPlatform.Tests.Analytics;

public class GetAiUsageQueryHandlerTests
{
    private readonly Mock<IUnitOfWork> _uow = new();
    private readonly Mock<IAiUsageRepository> _aiUsage = new();
    private readonly GetAiUsageQueryHandler _handler;
    private readonly Guid _userId = Guid.NewGuid();

    public GetAiUsageQueryHandlerTests()
    {
        _uow.Setup(u => u.AiUsage).Returns(_aiUsage.Object);
        _aiUsage.Setup(r => r.GetTotalsAsync(_userId, It.IsAny<DateTime>(), It.IsAny<DateTime>(), default))
            .ReturnsAsync(AiUsageTotals.Empty);
        _aiUsage.Setup(r => r.GetByOperationAsync(_userId, It.IsAny<DateTime>(), It.IsAny<DateTime>(), default))
            .ReturnsAsync(Array.Empty<AiUsageGroup>());
        _aiUsage.Setup(r => r.GetByModelAsync(_userId, It.IsAny<DateTime>(), It.IsAny<DateTime>(), default))
            .ReturnsAsync(Array.Empty<AiUsageGroup>());
        _aiUsage.Setup(r => r.GetDailyAsync(_userId, It.IsAny<DateTime>(), It.IsAny<DateTime>(), default))
            .ReturnsAsync(Array.Empty<AiUsageDay>());
        _handler = new GetAiUsageQueryHandler(_uow.Object, Options.Create(new AiUsageOptions { DailyTokenLimit = 100_000 }));
    }

    [Fact]
    public async Task Handle_FromAfterTo_ReturnsFailure()
    {
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var result = await _handler.Handle(new GetAiUsageQuery(_userId, today, today.AddDays(-5)), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("INVALID_DATE_RANGE", result.ErrorCode);
    }

    [Fact]
    public async Task Handle_RangeTooLarge_ReturnsFailure()
    {
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var result = await _handler.Handle(new GetAiUsageQuery(_userId, today.AddDays(-400), today), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("RANGE_TOO_LARGE", result.ErrorCode);
    }

    [Fact]
    public async Task Handle_NoDatesProvided_DefaultsToLast30Days()
    {
        var result = await _handler.Handle(new GetAiUsageQuery(_userId, null, null), default);

        Assert.True(result.IsSuccess);
        Assert.Equal(29, (result.Data!.To.DayNumber - result.Data.From.DayNumber));
    }

    [Fact]
    public async Task Handle_ReturnsTotalsAndDailyLimit()
    {
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        _aiUsage.Setup(r => r.GetTotalsAsync(_userId, It.IsAny<DateTime>(), It.IsAny<DateTime>(), default))
            .ReturnsAsync(new AiUsageTotals(5, 1000, 500, 100, 1500, 0.25m));

        var result = await _handler.Handle(new GetAiUsageQuery(_userId, today.AddDays(-7), today), default);

        Assert.True(result.IsSuccess);
        Assert.Equal(5, result.Data!.Totals.Calls);
        Assert.Equal(1500, result.Data.Totals.TotalTokens);
        Assert.Equal(100_000, result.Data.DailyTokenLimit);
    }

    [Fact]
    public async Task Handle_MapsByOperationAndByModelGroups()
    {
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        _aiUsage.Setup(r => r.GetByOperationAsync(_userId, It.IsAny<DateTime>(), It.IsAny<DateTime>(), default))
            .ReturnsAsync(new[] { new AiUsageGroup("quiz:text", 3, 900, 0.1m) });
        _aiUsage.Setup(r => r.GetByModelAsync(_userId, It.IsAny<DateTime>(), It.IsAny<DateTime>(), default))
            .ReturnsAsync(new[] { new AiUsageGroup("gpt-4o", 3, 900, 0.1m) });

        var result = await _handler.Handle(new GetAiUsageQuery(_userId, today.AddDays(-7), today), default);

        Assert.True(result.IsSuccess);
        Assert.Single(result.Data!.ByOperation);
        Assert.Equal("quiz:text", result.Data.ByOperation[0].Key);
        Assert.Single(result.Data.ByModel);
        Assert.Equal("gpt-4o", result.Data.ByModel[0].Key);
    }
}
