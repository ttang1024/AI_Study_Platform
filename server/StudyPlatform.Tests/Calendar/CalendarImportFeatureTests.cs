using System.Linq.Expressions;
using Microsoft.Extensions.Logging;
using Moq;
using StudyPlatform.Application.Calendar;
using StudyPlatform.Application.Services;
using StudyPlatform.Domain.Entities;
using StudyPlatform.Domain.Interfaces;
using Xunit;

namespace StudyPlatform.Tests.Calendar;

public class GetCalendarFeedsQueryHandlerTests
{
    private readonly Mock<IUnitOfWork> _uow = new();
    private readonly Mock<IUserCalendarFeedRepository> _feeds = new();
    private readonly GetCalendarFeedsQueryHandler _handler;
    private readonly Guid _userId = Guid.NewGuid();

    public GetCalendarFeedsQueryHandlerTests()
    {
        _uow.Setup(u => u.UserCalendarFeeds).Returns(_feeds.Object);
        _handler = new GetCalendarFeedsQueryHandler(_uow.Object);
    }

    [Fact]
    public async Task Handle_OrdersFeedsByCreatedAt()
    {
        var newer = new UserCalendarFeed { Id = Guid.NewGuid(), UserId = _userId, Name = "Newer", CreatedAt = DateTime.UtcNow };
        var older = new UserCalendarFeed { Id = Guid.NewGuid(), UserId = _userId, Name = "Older", CreatedAt = DateTime.UtcNow.AddDays(-5) };
        _feeds.Setup(r => r.FindAsync(It.IsAny<Expression<Func<UserCalendarFeed, bool>>>(), default)).ReturnsAsync(new[] { newer, older });

        var result = await _handler.Handle(new GetCalendarFeedsQuery(_userId), default);

        Assert.Equal(new[] { "Older", "Newer" }, result.Data!.Select(f => f.Name));
    }
}

public class AddCalendarFeedCommandHandlerTests
{
    private readonly Mock<IUnitOfWork> _uow = new();
    private readonly Mock<IUserCalendarFeedRepository> _feeds = new();
    private readonly Mock<ICalendarFeedService> _feedService = new();
    private readonly AddCalendarFeedCommandHandler _handler;
    private readonly Guid _userId = Guid.NewGuid();

    public AddCalendarFeedCommandHandlerTests()
    {
        _uow.Setup(u => u.UserCalendarFeeds).Returns(_feeds.Object);
        _uow.Setup(u => u.SaveChangesAsync(default)).ReturnsAsync(1);
        _feeds.Setup(r => r.FindAsync(It.IsAny<Expression<Func<UserCalendarFeed, bool>>>(), default)).ReturnsAsync(Array.Empty<UserCalendarFeed>());
        _feeds.Setup(r => r.AddAsync(It.IsAny<UserCalendarFeed>(), default)).Returns(Task.CompletedTask);
        _feedService.Setup(s => s.FetchBusyBlocksAsync(It.IsAny<string>(), It.IsAny<DateTime>(), It.IsAny<DateTime>(), default))
            .ReturnsAsync(Array.Empty<BusyBlock>());
        _handler = new AddCalendarFeedCommandHandler(_uow.Object, _feedService.Object);
    }

    [Theory]
    [InlineData("not a url")]
    [InlineData("ftp://example.com/cal.ics")]
    public async Task Handle_InvalidUrl_ReturnsFailure(string url)
    {
        var result = await _handler.Handle(new AddCalendarFeedCommand(_userId, "My Calendar", url), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("INVALID_URL", result.ErrorCode);
    }

    [Theory]
    [InlineData("https://example.com/cal.ics")]
    [InlineData("http://example.com/cal.ics")]
    [InlineData("webcal://example.com/cal.ics")]
    public async Task Handle_AcceptedUrlSchemes(string url)
    {
        var result = await _handler.Handle(new AddCalendarFeedCommand(_userId, "My Calendar", url), default);

        Assert.True(result.IsSuccess);
    }

    [Fact]
    public async Task Handle_AtFeedLimit_ReturnsFailure()
    {
        var existing = Enumerable.Range(0, 5).Select(_ => new UserCalendarFeed { Id = Guid.NewGuid(), UserId = _userId }).ToArray();
        _feeds.Setup(r => r.FindAsync(It.IsAny<Expression<Func<UserCalendarFeed, bool>>>(), default)).ReturnsAsync(existing);

        var result = await _handler.Handle(new AddCalendarFeedCommand(_userId, "Name", "https://example.com/cal.ics"), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("TOO_MANY_FEEDS", result.ErrorCode);
    }

    [Fact]
    public async Task Handle_DuplicateUrl_ReturnsFailure()
    {
        _feeds.Setup(r => r.FindAsync(It.IsAny<Expression<Func<UserCalendarFeed, bool>>>(), default))
            .ReturnsAsync(new[] { new UserCalendarFeed { Id = Guid.NewGuid(), UserId = _userId, Url = "https://example.com/cal.ics" } });

        var result = await _handler.Handle(new AddCalendarFeedCommand(_userId, "Name", "https://example.com/cal.ics"), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("DUPLICATE_FEED", result.ErrorCode);
    }

    [Fact]
    public async Task Handle_FetchThrowsHttpException_ReturnsFetchFailed()
    {
        _feedService.Setup(s => s.FetchBusyBlocksAsync(It.IsAny<string>(), It.IsAny<DateTime>(), It.IsAny<DateTime>(), default))
            .ThrowsAsync(new HttpRequestException("network down"));

        var result = await _handler.Handle(new AddCalendarFeedCommand(_userId, "Name", "https://example.com/cal.ics"), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("FETCH_FAILED", result.ErrorCode);
    }

    [Fact]
    public async Task Handle_BlankName_DefaultsToCalendar()
    {
        var result = await _handler.Handle(new AddCalendarFeedCommand(_userId, "  ", "https://example.com/cal.ics"), default);

        Assert.Equal("Calendar", result.Data!.Name);
    }

    [Fact]
    public async Task Handle_ValidRequest_TrimsUrlAndName()
    {
        var result = await _handler.Handle(new AddCalendarFeedCommand(_userId, "  My Calendar  ", "  https://example.com/cal.ics  "), default);

        Assert.True(result.IsSuccess);
        Assert.Equal("My Calendar", result.Data!.Name);
        Assert.Equal("https://example.com/cal.ics", result.Data.Url);
    }
}

public class RemoveCalendarFeedCommandHandlerTests
{
    private readonly Mock<IUnitOfWork> _uow = new();
    private readonly Mock<IUserCalendarFeedRepository> _feeds = new();
    private readonly RemoveCalendarFeedCommandHandler _handler;
    private readonly Guid _userId = Guid.NewGuid();
    private readonly Guid _feedId = Guid.NewGuid();

    public RemoveCalendarFeedCommandHandlerTests()
    {
        _uow.Setup(u => u.UserCalendarFeeds).Returns(_feeds.Object);
        _uow.Setup(u => u.SaveChangesAsync(default)).ReturnsAsync(1);
        _handler = new RemoveCalendarFeedCommandHandler(_uow.Object);
    }

    [Fact]
    public async Task Handle_NotOwned_ReturnsFailure()
    {
        _feeds.Setup(r => r.GetByIdAsync(_feedId, default)).ReturnsAsync(new UserCalendarFeed { Id = _feedId, UserId = Guid.NewGuid() });

        var result = await _handler.Handle(new RemoveCalendarFeedCommand(_userId, _feedId), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("FEED_NOT_FOUND", result.ErrorCode);
    }

    [Fact]
    public async Task Handle_Owned_RemovesSuccessfully()
    {
        var feed = new UserCalendarFeed { Id = _feedId, UserId = _userId };
        _feeds.Setup(r => r.GetByIdAsync(_feedId, default)).ReturnsAsync(feed);

        var result = await _handler.Handle(new RemoveCalendarFeedCommand(_userId, _feedId), default);

        Assert.True(result.IsSuccess);
        _feeds.Verify(r => r.Remove(feed), Times.Once);
    }
}

public class GetBusyTimesQueryHandlerTests
{
    private readonly Mock<IUnitOfWork> _uow = new();
    private readonly Mock<IUserCalendarFeedRepository> _feeds = new();
    private readonly Mock<ICalendarFeedService> _feedService = new();
    private readonly Mock<IAppCache> _cache = new();
    private readonly GetBusyTimesQueryHandler _handler;
    private readonly Guid _userId = Guid.NewGuid();

    public GetBusyTimesQueryHandlerTests()
    {
        _uow.Setup(u => u.UserCalendarFeeds).Returns(_feeds.Object);
        _uow.Setup(u => u.SaveChangesAsync(default)).ReturnsAsync(1);
        _cache.Setup(c => c.GetOrCreateAsync(
                It.IsAny<string>(), It.IsAny<Func<CancellationToken, Task<BusyTimesDto>>>(),
                It.IsAny<TimeSpan>(), It.IsAny<CancellationToken>()))
            .Returns((string _, Func<CancellationToken, Task<BusyTimesDto>> factory, TimeSpan _, CancellationToken ct) => factory(ct));
        _handler = new GetBusyTimesQueryHandler(_uow.Object, _feedService.Object, _cache.Object, Mock.Of<ILogger<GetBusyTimesQueryHandler>>());
    }

    [Fact]
    public async Task Handle_NoFeeds_ReturnsEmptyDaysWithinRange()
    {
        _feeds.Setup(r => r.FindAsync(It.IsAny<Expression<Func<UserCalendarFeed, bool>>>(), default)).ReturnsAsync(Array.Empty<UserCalendarFeed>());
        var from = DateTime.UtcNow.Date;

        var result = await _handler.Handle(new GetBusyTimesQuery(_userId, from, from.AddDays(3)), default);

        Assert.True(result.IsSuccess);
        Assert.Equal(3, result.Data!.Days.Count);
        Assert.All(result.Data.Days, d => Assert.Equal(0, d.BusyMinutes));
    }

    [Fact]
    public async Task Handle_ToBeforeOrEqualFrom_DefaultsToA7DayWindow()
    {
        _feeds.Setup(r => r.FindAsync(It.IsAny<Expression<Func<UserCalendarFeed, bool>>>(), default)).ReturnsAsync(Array.Empty<UserCalendarFeed>());
        var from = DateTime.UtcNow.Date;

        var result = await _handler.Handle(new GetBusyTimesQuery(_userId, from, from), default);

        Assert.Equal(7, result.Data!.Days.Count);
    }

    [Fact]
    public async Task Handle_ClampsWindowTo31Days()
    {
        _feeds.Setup(r => r.FindAsync(It.IsAny<Expression<Func<UserCalendarFeed, bool>>>(), default)).ReturnsAsync(Array.Empty<UserCalendarFeed>());
        var from = DateTime.UtcNow.Date;

        var result = await _handler.Handle(new GetBusyTimesQuery(_userId, from, from.AddDays(90)), default);

        Assert.Equal(31, result.Data!.Days.Count);
    }

    [Fact]
    public async Task Handle_TimedBlock_ContributesOverlapMinutesToEachDay()
    {
        var from = DateTime.UtcNow.Date;
        var feed = new UserCalendarFeed { Id = Guid.NewGuid(), UserId = _userId, Url = "https://x.com/cal.ics", Name = "Work" };
        _feeds.Setup(r => r.FindAsync(It.IsAny<Expression<Func<UserCalendarFeed, bool>>>(), default)).ReturnsAsync(new[] { feed });
        _feedService.Setup(s => s.FetchBusyBlocksAsync(feed.Url, from, from.AddDays(2), default))
            .ReturnsAsync(new[] { new BusyBlock(from.AddHours(9), from.AddHours(10), "Meeting", false) });

        var result = await _handler.Handle(new GetBusyTimesQuery(_userId, from, from.AddDays(2)), default);

        Assert.Equal(60, result.Data!.Days[0].BusyMinutes);
        Assert.Equal(0, result.Data.Days[1].BusyMinutes);
    }

    [Fact]
    public async Task Handle_AllDayBlock_DoesNotCountTowardBusyMinutes()
    {
        var from = DateTime.UtcNow.Date;
        var feed = new UserCalendarFeed { Id = Guid.NewGuid(), UserId = _userId, Url = "https://x.com/cal.ics", Name = "Work" };
        _feeds.Setup(r => r.FindAsync(It.IsAny<Expression<Func<UserCalendarFeed, bool>>>(), default)).ReturnsAsync(new[] { feed });
        _feedService.Setup(s => s.FetchBusyBlocksAsync(feed.Url, from, from.AddDays(1), default))
            .ReturnsAsync(new[] { new BusyBlock(from, from.AddDays(1), "Holiday", true) });

        var result = await _handler.Handle(new GetBusyTimesQuery(_userId, from, from.AddDays(1)), default);

        Assert.Equal(0, result.Data!.Days[0].BusyMinutes);
        Assert.Single(result.Data.Days[0].Blocks);
    }

    [Fact]
    public async Task Handle_FeedFetchFails_RecordsErrorAndContinues()
    {
        var from = DateTime.UtcNow.Date;
        var feed = new UserCalendarFeed { Id = Guid.NewGuid(), UserId = _userId, Url = "https://x.com/cal.ics" };
        _feeds.Setup(r => r.FindAsync(It.IsAny<Expression<Func<UserCalendarFeed, bool>>>(), default)).ReturnsAsync(new[] { feed });
        _feedService.Setup(s => s.FetchBusyBlocksAsync(feed.Url, from, from.AddDays(1), default))
            .ThrowsAsync(new HttpRequestException("down"));

        var result = await _handler.Handle(new GetBusyTimesQuery(_userId, from, from.AddDays(1)), default);

        Assert.True(result.IsSuccess);
        Assert.Equal("down", feed.LastError);
        _feeds.Verify(r => r.Update(feed), Times.Once);
    }

    [Fact]
    public async Task Handle_SuccessfulFetch_ClearsPriorErrorAndUpdatesSyncTime()
    {
        var from = DateTime.UtcNow.Date;
        var feed = new UserCalendarFeed { Id = Guid.NewGuid(), UserId = _userId, Url = "https://x.com/cal.ics", LastError = "old error" };
        _feeds.Setup(r => r.FindAsync(It.IsAny<Expression<Func<UserCalendarFeed, bool>>>(), default)).ReturnsAsync(new[] { feed });
        _feedService.Setup(s => s.FetchBusyBlocksAsync(feed.Url, from, from.AddDays(1), default))
            .ReturnsAsync(Array.Empty<BusyBlock>());

        await _handler.Handle(new GetBusyTimesQuery(_userId, from, from.AddDays(1)), default);

        Assert.Null(feed.LastError);
        Assert.NotNull(feed.LastSyncedAt);
    }
}
