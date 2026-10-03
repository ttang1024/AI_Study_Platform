using System.Linq.Expressions;
using Moq;
using StudyPlatform.Application.Planner;
using StudyPlatform.Domain.Entities;
using StudyPlatform.Domain.Interfaces;
using Xunit;

namespace StudyPlatform.Tests.Planner;

public class CreateExamPlanCommandHandlerTests
{
    private readonly Mock<IUnitOfWork> _uow = new();
    private readonly Mock<IExamPlanRepository> _plans = new();
    private readonly Mock<ICourseRepository> _courses = new();
    private readonly CreateExamPlanCommandHandler _handler;
    private readonly Guid _userId = Guid.NewGuid();

    public CreateExamPlanCommandHandlerTests()
    {
        _uow.Setup(u => u.ExamPlans).Returns(_plans.Object);
        _uow.Setup(u => u.Courses).Returns(_courses.Object);
        _uow.Setup(u => u.SaveChangesAsync(default)).ReturnsAsync(1);
        _plans.Setup(r => r.AddAsync(It.IsAny<ExamPlan>(), default)).Returns(Task.CompletedTask);
        _handler = new CreateExamPlanCommandHandler(_uow.Object);
    }

    [Fact]
    public async Task Handle_BlankTitle_ReturnsFailure()
    {
        var result = await _handler.Handle(new CreateExamPlanCommand(_userId, "  ", DateTime.UtcNow.AddDays(10), null, 30), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("TITLE_REQUIRED", result.ErrorCode);
    }

    [Fact]
    public async Task Handle_PastExamDate_ReturnsFailure()
    {
        var result = await _handler.Handle(new CreateExamPlanCommand(_userId, "Finals", DateTime.UtcNow.AddDays(-1), null, 30), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("DATE_IN_PAST", result.ErrorCode);
    }

    [Fact]
    public async Task Handle_CourseNotFoundOrNotOwned_ReturnsFailure()
    {
        var courseId = Guid.NewGuid();
        _courses.Setup(r => r.GetByIdAsync(courseId, default)).ReturnsAsync(new Course { CourseId = courseId, UserId = Guid.NewGuid() });

        var result = await _handler.Handle(new CreateExamPlanCommand(_userId, "Finals", DateTime.UtcNow.AddDays(10), courseId, 30), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("COURSE_NOT_FOUND", result.ErrorCode);
    }

    [Fact]
    public async Task Handle_ValidRequest_ClampsDailyMinutesAndTrimsTitle()
    {
        var result = await _handler.Handle(
            new CreateExamPlanCommand(_userId, "  Finals  ", DateTime.UtcNow.AddDays(10), null, 5000), default);

        Assert.True(result.IsSuccess);
        Assert.Equal("Finals", result.Data!.Title);
        Assert.Equal(480, result.Data.DailyMinutes);
    }

    [Fact]
    public async Task Handle_LowDailyMinutes_ClampsUpTo10()
    {
        var result = await _handler.Handle(
            new CreateExamPlanCommand(_userId, "Finals", DateTime.UtcNow.AddDays(10), null, 1), default);

        Assert.Equal(10, result.Data!.DailyMinutes);
    }

    [Fact]
    public async Task Handle_DaysRemainingComputedFromExamDate()
    {
        var examDate = DateTime.UtcNow.Date.AddDays(7);
        var result = await _handler.Handle(new CreateExamPlanCommand(_userId, "Finals", examDate, null, 30), default);

        Assert.Equal(7, result.Data!.DaysRemaining);
    }
}

public class DeleteExamPlanCommandHandlerTests
{
    private readonly Mock<IUnitOfWork> _uow = new();
    private readonly Mock<IExamPlanRepository> _plans = new();
    private readonly DeleteExamPlanCommandHandler _handler;
    private readonly Guid _userId = Guid.NewGuid();
    private readonly Guid _planId = Guid.NewGuid();

    public DeleteExamPlanCommandHandlerTests()
    {
        _uow.Setup(u => u.ExamPlans).Returns(_plans.Object);
        _uow.Setup(u => u.SaveChangesAsync(default)).ReturnsAsync(1);
        _handler = new DeleteExamPlanCommandHandler(_uow.Object);
    }

    [Fact]
    public async Task Handle_NotFound_ReturnsFailure()
    {
        _plans.Setup(r => r.FirstOrDefaultAsync(It.IsAny<Expression<Func<ExamPlan, bool>>>(), default)).ReturnsAsync((ExamPlan?)null);

        var result = await _handler.Handle(new DeleteExamPlanCommand(_planId, _userId), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("PLAN_NOT_FOUND", result.ErrorCode);
    }

    [Fact]
    public async Task Handle_Found_RemovesAndSucceeds()
    {
        var plan = new ExamPlan { ExamPlanId = _planId, UserId = _userId };
        _plans.Setup(r => r.FirstOrDefaultAsync(It.IsAny<Expression<Func<ExamPlan, bool>>>(), default)).ReturnsAsync(plan);

        var result = await _handler.Handle(new DeleteExamPlanCommand(_planId, _userId), default);

        Assert.True(result.IsSuccess);
        Assert.True(result.Data);
        _plans.Verify(r => r.Remove(plan), Times.Once);
    }
}

public class GetExamPlansQueryHandlerTests
{
    private readonly Mock<IUnitOfWork> _uow = new();
    private readonly Mock<IExamPlanRepository> _plans = new();
    private readonly Mock<ICourseRepository> _courses = new();
    private readonly GetExamPlansQueryHandler _handler;
    private readonly Guid _userId = Guid.NewGuid();

    public GetExamPlansQueryHandlerTests()
    {
        _uow.Setup(u => u.ExamPlans).Returns(_plans.Object);
        _uow.Setup(u => u.Courses).Returns(_courses.Object);
        _handler = new GetExamPlansQueryHandler(_uow.Object);
    }

    [Fact]
    public async Task Handle_OrdersByExamDateAscending()
    {
        var later = new ExamPlan { ExamPlanId = Guid.NewGuid(), UserId = _userId, Title = "Later", ExamDate = DateTime.UtcNow.AddDays(20) };
        var sooner = new ExamPlan { ExamPlanId = Guid.NewGuid(), UserId = _userId, Title = "Sooner", ExamDate = DateTime.UtcNow.AddDays(5) };
        _plans.Setup(r => r.FindAsync(It.IsAny<Expression<Func<ExamPlan, bool>>>(), default)).ReturnsAsync(new[] { later, sooner });
        _courses.Setup(r => r.FindAsync(It.IsAny<Expression<Func<Course, bool>>>(), default)).ReturnsAsync(Array.Empty<Course>());

        var result = await _handler.Handle(new GetExamPlansQuery(_userId), default);

        Assert.Equal(new[] { "Sooner", "Later" }, result.Data!.Select(p => p.Title));
    }

    [Fact]
    public async Task Handle_AttachesCourseNameWhenCourseExists()
    {
        var courseId = Guid.NewGuid();
        var plan = new ExamPlan { ExamPlanId = Guid.NewGuid(), UserId = _userId, CourseId = courseId, ExamDate = DateTime.UtcNow.AddDays(5) };
        _plans.Setup(r => r.FindAsync(It.IsAny<Expression<Func<ExamPlan, bool>>>(), default)).ReturnsAsync(new[] { plan });
        _courses.Setup(r => r.FindAsync(It.IsAny<Expression<Func<Course, bool>>>(), default))
            .ReturnsAsync(new[] { new Course { CourseId = courseId, UserId = _userId, CourseName = "Algorithms" } });

        var result = await _handler.Handle(new GetExamPlansQuery(_userId), default);

        Assert.Equal("Algorithms", result.Data!.Single().CourseName);
    }

    [Fact]
    public async Task Handle_CourseNameNullWhenCourseWasDeleted()
    {
        var plan = new ExamPlan { ExamPlanId = Guid.NewGuid(), UserId = _userId, CourseId = Guid.NewGuid(), ExamDate = DateTime.UtcNow.AddDays(5) };
        _plans.Setup(r => r.FindAsync(It.IsAny<Expression<Func<ExamPlan, bool>>>(), default)).ReturnsAsync(new[] { plan });
        _courses.Setup(r => r.FindAsync(It.IsAny<Expression<Func<Course, bool>>>(), default)).ReturnsAsync(Array.Empty<Course>());

        var result = await _handler.Handle(new GetExamPlansQuery(_userId), default);

        Assert.Null(result.Data!.Single().CourseName);
    }
}
