using Moq;
using StudyPlatform.Application.Analytics.Commands;
using StudyPlatform.Application.Services;
using StudyPlatform.Domain.Entities;
using StudyPlatform.Domain.Interfaces;
using Xunit;

namespace StudyPlatform.Tests.Analytics;

public class SetVacationCommandHandlerTests
{
    private readonly Mock<IUnitOfWork> _uow = new();
    private readonly Mock<IStreakCoverDayRepository> _covers = new();
    private readonly Mock<IAppCache> _cache = new();
    private readonly SetVacationCommandHandler _handler;
    private readonly Guid _userId = Guid.NewGuid();

    public SetVacationCommandHandlerTests()
    {
        _uow.Setup(u => u.StreakCoverDays).Returns(_covers.Object);
        _covers.Setup(r => r.GetByUserAsync(_userId, default)).ReturnsAsync(Array.Empty<StreakCoverDay>());
        _covers.Setup(r => r.AddAsync(It.IsAny<StreakCoverDay>(), default)).Returns(Task.CompletedTask);
        _handler = new SetVacationCommandHandler(_uow.Object, _cache.Object);
    }

    private static DateTime Today => DateTime.UtcNow.Date;

    [Fact]
    public async Task Handle_EndBeforeStart_ReturnsFailure()
    {
        var result = await _handler.Handle(new SetVacationCommand(_userId, Today.AddDays(5), Today.AddDays(2)), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("INVALID_RANGE", result.ErrorCode);
    }

    [Fact]
    public async Task Handle_RangeTooLong_ReturnsFailure()
    {
        var result = await _handler.Handle(new SetVacationCommand(_userId, Today, Today.AddDays(65)), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("RANGE_TOO_LONG", result.ErrorCode);
    }

    [Fact]
    public async Task Handle_StartInPast_ClampsToToday()
    {
        var result = await _handler.Handle(new SetVacationCommand(_userId, Today.AddDays(-10), Today.AddDays(2)), default);

        Assert.True(result.IsSuccess);
        _covers.Verify(r => r.AddAsync(It.IsAny<StreakCoverDay>(), default), Times.Exactly(3)); // today, +1, +2
    }

    [Fact]
    public async Task Handle_ValidRange_AddsCoverDaysForEachDay()
    {
        var result = await _handler.Handle(new SetVacationCommand(_userId, Today, Today.AddDays(2)), default);

        Assert.True(result.IsSuccess);
        _covers.Verify(r => r.AddAsync(It.Is<StreakCoverDay>(c => c.Type == "vacation"), default), Times.Exactly(3));
        _uow.Verify(u => u.SaveChangesAsync(default), Times.Once);
        _cache.Verify(c => c.RemoveAsync(It.IsAny<string>(), default), Times.Once);
    }

    [Fact]
    public async Task Handle_ReplacesExistingUpcomingVacation()
    {
        var existing = new StreakCoverDay { Id = Guid.NewGuid(), UserId = _userId, Date = Today.AddDays(1), Type = "vacation" };
        _covers.Setup(r => r.GetByUserAsync(_userId, default)).ReturnsAsync(new[] { existing });

        var result = await _handler.Handle(new SetVacationCommand(_userId, Today, Today), default);

        Assert.True(result.IsSuccess);
        _covers.Verify(r => r.RemoveRange(It.Is<IEnumerable<StreakCoverDay>>(e => e.Contains(existing))), Times.Once);
    }

    [Fact]
    public async Task Handle_KeepsPastFreezeDaysAsOccupied_SkipsOverlap()
    {
        var pastFreeze = new StreakCoverDay { Id = Guid.NewGuid(), UserId = _userId, Date = Today, Type = "freeze" };
        _covers.Setup(r => r.GetByUserAsync(_userId, default)).ReturnsAsync(new[] { pastFreeze });

        var result = await _handler.Handle(new SetVacationCommand(_userId, Today, Today), default);

        Assert.True(result.IsSuccess);
        _covers.Verify(r => r.AddAsync(It.IsAny<StreakCoverDay>(), default), Times.Never);
    }
}

public class CancelVacationCommandHandlerTests
{
    private readonly Mock<IUnitOfWork> _uow = new();
    private readonly Mock<IStreakCoverDayRepository> _covers = new();
    private readonly Mock<IAppCache> _cache = new();
    private readonly CancelVacationCommandHandler _handler;
    private readonly Guid _userId = Guid.NewGuid();

    public CancelVacationCommandHandlerTests()
    {
        _uow.Setup(u => u.StreakCoverDays).Returns(_covers.Object);
        _handler = new CancelVacationCommandHandler(_uow.Object, _cache.Object);
    }

    [Fact]
    public async Task Handle_RemovesUpcomingVacationOnly()
    {
        var today = DateTime.UtcNow.Date;
        var upcoming = new StreakCoverDay { Id = Guid.NewGuid(), UserId = _userId, Date = today.AddDays(1), Type = "vacation" };
        var past = new StreakCoverDay { Id = Guid.NewGuid(), UserId = _userId, Date = today.AddDays(-5), Type = "vacation" };
        var freeze = new StreakCoverDay { Id = Guid.NewGuid(), UserId = _userId, Date = today.AddDays(1), Type = "freeze" };
        _covers.Setup(r => r.GetByUserAsync(_userId, default)).ReturnsAsync(new[] { upcoming, past, freeze });

        var result = await _handler.Handle(new CancelVacationCommand(_userId), default);

        Assert.True(result.IsSuccess);
        _covers.Verify(r => r.RemoveRange(It.Is<IEnumerable<StreakCoverDay>>(e => e.Count() == 1 && e.Contains(upcoming))), Times.Once);
        _uow.Verify(u => u.SaveChangesAsync(default), Times.Once);
        _cache.Verify(c => c.RemoveAsync(It.IsAny<string>(), default), Times.Once);
    }
}
