using Microsoft.Extensions.Options;
using Moq;
using StudyPlatform.Application.Analytics.DTOs;
using StudyPlatform.Application.Analytics.Queries;
using StudyPlatform.Application.Services;
using StudyPlatform.Application.Settings;
using StudyPlatform.Domain.Entities;
using StudyPlatform.Domain.Interfaces;
using StudyPlatform.Domain.Projections;
using Xunit;

namespace StudyPlatform.Tests.Analytics;

public class RecordStudySessionCommandHandlerTests
{
    private readonly Mock<IUnitOfWork> _uow = new();
    private readonly Mock<IStudySessionRepository> _sessions = new();
    private readonly RecordStudySessionCommandHandler _handler;
    private readonly Guid _userId = Guid.NewGuid();

    public RecordStudySessionCommandHandlerTests()
    {
        _uow.Setup(u => u.StudySessions).Returns(_sessions.Object);
        _sessions.Setup(r => r.AddAsync(It.IsAny<StudySession>(), default)).Returns(Task.CompletedTask);
        _handler = new RecordStudySessionCommandHandler(_uow.Object);
    }

    [Fact]
    public async Task Handle_ZeroDuration_ReturnsSuccessWithoutPersisting()
    {
        var result = await _handler.Handle(new RecordStudySessionCommand(_userId, null, "document", null, 0), default);

        Assert.True(result.IsSuccess);
        _sessions.Verify(r => r.AddAsync(It.IsAny<StudySession>(), default), Times.Never);
    }

    [Fact]
    public async Task Handle_ExcessiveDuration_ClampsToMax()
    {
        StudySession? captured = null;
        _sessions.Setup(r => r.AddAsync(It.IsAny<StudySession>(), default))
            .Callback<StudySession, CancellationToken>((s, _) => captured = s)
            .Returns(Task.CompletedTask);

        var result = await _handler.Handle(new RecordStudySessionCommand(_userId, null, "document", null, 99999), default);

        Assert.True(result.IsSuccess);
        Assert.Equal(600, captured!.DurationSeconds);
    }

    [Fact]
    public async Task Handle_BlankContextType_DefaultsToGeneral()
    {
        StudySession? captured = null;
        _sessions.Setup(r => r.AddAsync(It.IsAny<StudySession>(), default))
            .Callback<StudySession, CancellationToken>((s, _) => captured = s)
            .Returns(Task.CompletedTask);

        var result = await _handler.Handle(new RecordStudySessionCommand(_userId, null, "  ", null, 60), default);

        Assert.True(result.IsSuccess);
        Assert.Equal("general", captured!.ContextType);
    }

    [Fact]
    public async Task Handle_ValidDuration_PersistsSession()
    {
        var courseId = Guid.NewGuid();
        var result = await _handler.Handle(new RecordStudySessionCommand(_userId, courseId, "video", Guid.NewGuid(), 120), default);

        Assert.True(result.IsSuccess);
        _sessions.Verify(r => r.AddAsync(It.IsAny<StudySession>(), default), Times.Once);
        _uow.Verify(u => u.SaveChangesAsync(default), Times.Once);
    }
}

public class GetTimeOnTaskQueryHandlerTests
{
    private readonly Mock<IUnitOfWork> _uow = new();
    private readonly Mock<IStudySessionRepository> _sessions = new();
    private readonly Mock<ICourseRepository> _courses = new();
    private readonly GetTimeOnTaskQueryHandler _handler;
    private readonly Guid _userId = Guid.NewGuid();

    public GetTimeOnTaskQueryHandlerTests()
    {
        _uow.Setup(u => u.StudySessions).Returns(_sessions.Object);
        _uow.Setup(u => u.Courses).Returns(_courses.Object);
        _sessions.Setup(r => r.GetByDateRangeAsync(_userId, It.IsAny<DateTime>(), It.IsAny<DateTime>(), default))
            .ReturnsAsync(Array.Empty<StudySession>());
        _courses.Setup(r => r.GetListItemsByUserAsync(_userId, default)).ReturnsAsync(Array.Empty<CourseListItem>());

        var cache = new Mock<IAppCache>();
        cache.Setup(c => c.GetOrCreateAsync(
                It.IsAny<string>(), It.IsAny<Func<CancellationToken, Task<TimeOnTaskDto>>>(),
                It.IsAny<TimeSpan>(), It.IsAny<CancellationToken>()))
            .Returns((string _, Func<CancellationToken, Task<TimeOnTaskDto>> factory, TimeSpan _, CancellationToken ct) => factory(ct));

        _handler = new GetTimeOnTaskQueryHandler(_uow.Object, cache.Object, Options.Create(new CacheOptions()));
    }

    [Fact]
    public async Task Handle_NoSessions_ReturnsZeroTotals()
    {
        var result = await _handler.Handle(new GetTimeOnTaskQuery(_userId, DateTime.UtcNow.AddDays(-7), DateTime.UtcNow), default);

        Assert.True(result.IsSuccess);
        Assert.Equal(0, result.Data!.TotalSeconds);
        Assert.Empty(result.Data.Daily);
        Assert.Empty(result.Data.ByCourse);
    }

    [Fact]
    public async Task Handle_GroupsSessionsByDayAndCourse()
    {
        var courseId = Guid.NewGuid();
        var day = DateTime.UtcNow.Date;
        _sessions.Setup(r => r.GetByDateRangeAsync(_userId, It.IsAny<DateTime>(), It.IsAny<DateTime>(), default))
            .ReturnsAsync(new[]
            {
                new StudySession { StudySessionId = Guid.NewGuid(), UserId = _userId, CourseId = courseId, ContextType = "document", DurationSeconds = 120, OccurredAt = day },
                new StudySession { StudySessionId = Guid.NewGuid(), UserId = _userId, CourseId = courseId, ContextType = "document", DurationSeconds = 60, OccurredAt = day },
            });
        _courses.Setup(r => r.GetListItemsByUserAsync(_userId, default))
            .ReturnsAsync(new List<CourseListItem> { new(courseId, _userId, "Algorithms", "#123456", 1, DateTime.UtcNow, DateTime.UtcNow) });

        var result = await _handler.Handle(new GetTimeOnTaskQuery(_userId, day.AddDays(-1), day.AddDays(1)), default);

        Assert.Equal(180, result.Data!.TotalSeconds);
        var daily = Assert.Single(result.Data.Daily);
        Assert.Equal(180, daily.TotalSeconds);
        var byCourse = Assert.Single(result.Data.ByCourse);
        Assert.Equal("Algorithms", byCourse.CourseName);
        Assert.Equal(180, byCourse.TotalSeconds);
    }

    [Fact]
    public async Task Handle_SessionWithoutCourse_IsUnattributed()
    {
        var day = DateTime.UtcNow.Date;
        _sessions.Setup(r => r.GetByDateRangeAsync(_userId, It.IsAny<DateTime>(), It.IsAny<DateTime>(), default))
            .ReturnsAsync(new[]
            {
                new StudySession { StudySessionId = Guid.NewGuid(), UserId = _userId, CourseId = null, ContextType = "general", DurationSeconds = 60, OccurredAt = day },
            });

        var result = await _handler.Handle(new GetTimeOnTaskQuery(_userId, day.AddDays(-1), day.AddDays(1)), default);

        var byCourse = Assert.Single(result.Data!.ByCourse);
        Assert.Equal("Unattributed", byCourse.CourseName);
        Assert.Null(byCourse.CourseColor);
    }
}
