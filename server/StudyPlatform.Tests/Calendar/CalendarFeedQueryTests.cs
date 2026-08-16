using System.Linq.Expressions;
using MediatR;
using Moq;
using StudyPlatform.Application.Calendar;
using StudyPlatform.Application.Classrooms;
using StudyPlatform.Application.Common;
using StudyPlatform.Domain.Entities;
using StudyPlatform.Domain.Interfaces;
using Xunit;

namespace StudyPlatform.Tests.Calendar;

public class GetCalendarFeedQueryHandlerTests
{
    private readonly Mock<IUnitOfWork> _uow = new();
    private readonly Mock<IFlashcardSrsDataRepository> _srs = new();
    private readonly Mock<IExamPlanRepository> _plans = new();
    private readonly Mock<IMediator> _mediator = new();
    private readonly GetCalendarFeedQueryHandler _handler;
    private readonly Guid _userId = Guid.NewGuid();

    public GetCalendarFeedQueryHandlerTests()
    {
        _uow.Setup(u => u.FlashcardSrs).Returns(_srs.Object);
        _uow.Setup(u => u.ExamPlans).Returns(_plans.Object);
        _srs.Setup(r => r.FindAsNoTrackingAsync(It.IsAny<Expression<Func<FlashcardSrsData, bool>>>(), default))
            .ReturnsAsync(Array.Empty<FlashcardSrsData>());
        _plans.Setup(r => r.FindAsNoTrackingAsync(It.IsAny<Expression<Func<ExamPlan, bool>>>(), default))
            .ReturnsAsync(Array.Empty<ExamPlan>());
        _mediator.Setup(m => m.Send(It.IsAny<GetClassroomDeadlinesQuery>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(Result<IReadOnlyList<ClassroomDeadlineDto>>.Success(Array.Empty<ClassroomDeadlineDto>()));

        _handler = new GetCalendarFeedQueryHandler(_uow.Object, _mediator.Object);
    }

    [Fact]
    public async Task Handle_EmptyFeed_StillHasValidCalendarWrapper()
    {
        var result = await _handler.Handle(new GetCalendarFeedQuery(_userId), default);

        Assert.True(result.IsSuccess);
        Assert.StartsWith("BEGIN:VCALENDAR", result.Data);
        Assert.Contains("END:VCALENDAR", result.Data!);
    }

    [Fact]
    public async Task Handle_OverdueCards_RollIntoToday()
    {
        _srs.Setup(r => r.FindAsNoTrackingAsync(It.IsAny<Expression<Func<FlashcardSrsData, bool>>>(), default))
            .ReturnsAsync(new[] { new FlashcardSrsData { UserId = _userId, Due = DateTime.UtcNow.AddDays(-3) } });

        var result = await _handler.Handle(new GetCalendarFeedQuery(_userId), default);

        var today = DateTime.UtcNow.Date;
        Assert.Contains($"DTSTART;VALUE=DATE:{today:yyyyMMdd}", result.Data!);
        Assert.Contains("flashcard", result.Data);
    }

    [Fact]
    public async Task Handle_DueCardsGroupedByDayWithCorrectCount()
    {
        var due = DateTime.UtcNow.Date.AddDays(2);
        _srs.Setup(r => r.FindAsNoTrackingAsync(It.IsAny<Expression<Func<FlashcardSrsData, bool>>>(), default))
            .ReturnsAsync(new[]
            {
                new FlashcardSrsData { UserId = _userId, Due = due },
                new FlashcardSrsData { UserId = _userId, Due = due },
            });

        var result = await _handler.Handle(new GetCalendarFeedQuery(_userId), default);

        Assert.Contains("2 flashcards due", result.Data);
    }

    [Fact]
    public async Task Handle_ExamPlan_AddsExamDayAndPrepDays()
    {
        var plan = new ExamPlan { ExamPlanId = Guid.NewGuid(), UserId = _userId, Title = "Finals", ExamDate = DateTime.UtcNow.Date.AddDays(3), DailyMinutes = 45 };
        _plans.Setup(r => r.FindAsNoTrackingAsync(It.IsAny<Expression<Func<ExamPlan, bool>>>(), default)).ReturnsAsync(new[] { plan });

        var result = await _handler.Handle(new GetCalendarFeedQuery(_userId), default);

        Assert.Contains("Exam: Finals", result.Data);
        Assert.Contains("Study 45 min — Finals", result.Data);
    }

    [Fact]
    public async Task Handle_ClassroomDeadline_UsesATimedEventNotAllDay()
    {
        var dueAt = DateTime.UtcNow.AddDays(1);
        var deadline = new ClassroomDeadlineDto(Guid.NewGuid(), "CS 101", Guid.NewGuid(), null, "Essay", dueAt, "assigned", false);
        _mediator.Setup(m => m.Send(It.IsAny<GetClassroomDeadlinesQuery>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(Result<IReadOnlyList<ClassroomDeadlineDto>>.Success(new[] { deadline }));

        var result = await _handler.Handle(new GetCalendarFeedQuery(_userId), default);

        Assert.Contains("Due: Essay", result.Data);
        Assert.Contains($"DTSTART:{dueAt.ToUniversalTime():yyyyMMdd'T'HHmmss'Z'}", result.Data);
    }

    [Fact]
    public async Task Handle_SpecialCharactersInTitles_AreEscaped()
    {
        var plan = new ExamPlan { ExamPlanId = Guid.NewGuid(), UserId = _userId, Title = "Chem; Finals, Pt.1", ExamDate = DateTime.UtcNow.Date.AddDays(1), DailyMinutes = 30 };
        _plans.Setup(r => r.FindAsNoTrackingAsync(It.IsAny<Expression<Func<ExamPlan, bool>>>(), default)).ReturnsAsync(new[] { plan });

        var result = await _handler.Handle(new GetCalendarFeedQuery(_userId), default);

        Assert.Contains(@"Chem\; Finals\, Pt.1", result.Data);
    }
}
