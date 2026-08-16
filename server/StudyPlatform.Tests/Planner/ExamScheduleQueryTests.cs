using System.Linq.Expressions;
using MediatR;
using Moq;
using StudyPlatform.Application.Analytics.DTOs;
using StudyPlatform.Application.Analytics.Queries;
using StudyPlatform.Application.Common;
using StudyPlatform.Application.ConceptLinks;
using StudyPlatform.Application.Planner;
using StudyPlatform.Domain.Entities;
using StudyPlatform.Domain.Interfaces;
using Xunit;

namespace StudyPlatform.Tests.Planner;

public class GetExamScheduleQueryHandlerTests
{
    private readonly Mock<IUnitOfWork> _uow = new();
    private readonly Mock<IExamPlanRepository> _plans = new();
    private readonly Mock<ICourseRepository> _courses = new();
    private readonly Mock<IMistakeEntryRepository> _mistakes = new();
    private readonly Mock<IMediator> _mediator = new();
    private readonly GetExamScheduleQueryHandler _handler;
    private readonly Guid _userId = Guid.NewGuid();
    private readonly Guid _planId = Guid.NewGuid();

    public GetExamScheduleQueryHandlerTests()
    {
        _uow.Setup(u => u.ExamPlans).Returns(_plans.Object);
        _uow.Setup(u => u.Courses).Returns(_courses.Object);
        _uow.Setup(u => u.MistakeEntries).Returns(_mistakes.Object);
        _mistakes.Setup(r => r.CountAsync(It.IsAny<Expression<Func<MistakeEntry, bool>>>(), default)).ReturnsAsync(0);

        var emptyGaps = new KnowledgeGapsDto(Array.Empty<ConceptGapDto>(), new KnowledgeGapStatsDto(0, 0, 0, 0, 0));
        _mediator.Setup(m => m.Send(It.IsAny<GetKnowledgeGapsQuery>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(Result<KnowledgeGapsDto>.Success(emptyGaps));

        var summary = new DashboardSummaryDto(
            new StudyStreakDto(1, 1, 0, 0), 0, new ReinforcementCountsDto(0, 0, 0), 30);
        _mediator.Setup(m => m.Send(It.IsAny<GetDashboardSummaryQuery>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(Result<DashboardSummaryDto>.Success(summary));

        _handler = new GetExamScheduleQueryHandler(_uow.Object, _mediator.Object);
    }

    private ExamPlan MakePlan(int daysUntilExam, Guid? courseId = null, int dailyMinutes = 30) => new()
    {
        ExamPlanId = _planId,
        UserId = _userId,
        CourseId = courseId,
        Title = "Finals",
        ExamDate = DateTime.UtcNow.Date.AddDays(daysUntilExam),
        DailyMinutes = dailyMinutes,
    };

    [Fact]
    public async Task Handle_PlanNotFound_ReturnsFailure()
    {
        _plans.Setup(r => r.FirstOrDefaultAsync(It.IsAny<Expression<Func<ExamPlan, bool>>>(), default)).ReturnsAsync((ExamPlan?)null);

        var result = await _handler.Handle(new GetExamScheduleQuery(_planId, _userId), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("PLAN_NOT_FOUND", result.ErrorCode);
    }

    [Fact]
    public async Task Handle_ClampsScheduleTo21Days()
    {
        _plans.Setup(r => r.FirstOrDefaultAsync(It.IsAny<Expression<Func<ExamPlan, bool>>>(), default)).ReturnsAsync(MakePlan(60));

        var result = await _handler.Handle(new GetExamScheduleQuery(_planId, _userId), default);

        Assert.Equal(21, result.Data!.Days.Count);
    }

    [Fact]
    public async Task Handle_ShorterWindow_ProducesOneDayPerDayUntilExam()
    {
        _plans.Setup(r => r.FirstOrDefaultAsync(It.IsAny<Expression<Func<ExamPlan, bool>>>(), default)).ReturnsAsync(MakePlan(5));

        var result = await _handler.Handle(new GetExamScheduleQuery(_planId, _userId), default);

        Assert.Equal(5, result.Data!.Days.Count);
    }

    [Fact]
    public async Task Handle_FinalDay_IsALightRecapOnly()
    {
        _plans.Setup(r => r.FirstOrDefaultAsync(It.IsAny<Expression<Func<ExamPlan, bool>>>(), default)).ReturnsAsync(MakePlan(1));

        var result = await _handler.Handle(new GetExamScheduleQuery(_planId, _userId), default);

        var day = Assert.Single(result.Data!.Days);
        var task = Assert.Single(day.Tasks);
        Assert.Equal("review", task.Type);
    }

    [Fact]
    public async Task Handle_RegularDay_AlwaysIncludesFlashcardReview()
    {
        // Window of 6 so the final (recap-only) day is distinct from the regular days checked here.
        _plans.Setup(r => r.FirstOrDefaultAsync(It.IsAny<Expression<Func<ExamPlan, bool>>>(), default)).ReturnsAsync(MakePlan(6));

        var result = await _handler.Handle(new GetExamScheduleQuery(_planId, _userId), default);

        var regularDays = result.Data!.Days.Take(result.Data.Days.Count - 1);
        Assert.All(regularDays, day => Assert.Contains(day.Tasks, t => t.Type == "flashcards"));
    }

    [Fact]
    public async Task Handle_EveryThirdDay_IncludesAMockExam()
    {
        _plans.Setup(r => r.FirstOrDefaultAsync(It.IsAny<Expression<Func<ExamPlan, bool>>>(), default)).ReturnsAsync(MakePlan(5));

        var result = await _handler.Handle(new GetExamScheduleQuery(_planId, _userId), default);

        // Day index 2 (0-based) is the third day and should carry a mock-exam task.
        Assert.Contains(result.Data!.Days[2].Tasks, t => t.Type == "mock-exam");
    }

    [Fact]
    public async Task Handle_OpenMistakesPresent_NonMockDaysWorkThroughMistakes()
    {
        _mistakes.Setup(r => r.CountAsync(It.IsAny<Expression<Func<MistakeEntry, bool>>>(), default)).ReturnsAsync(3);
        _plans.Setup(r => r.FirstOrDefaultAsync(It.IsAny<Expression<Func<ExamPlan, bool>>>(), default)).ReturnsAsync(MakePlan(5));

        var result = await _handler.Handle(new GetExamScheduleQuery(_planId, _userId), default);

        Assert.Contains(result.Data!.Days[0].Tasks, t => t.Type == "mistakes");
    }

    [Fact]
    public async Task Handle_NoOpenMistakesAndNotMockDay_FallsBackToPractice()
    {
        _plans.Setup(r => r.FirstOrDefaultAsync(It.IsAny<Expression<Func<ExamPlan, bool>>>(), default)).ReturnsAsync(MakePlan(5));

        var result = await _handler.Handle(new GetExamScheduleQuery(_planId, _userId), default);

        Assert.Contains(result.Data!.Days[0].Tasks, t => t.Type == "practice");
    }

    [Fact]
    public async Task Handle_RelevantGaps_FilteredByPlanCourse()
    {
        var courseId = Guid.NewGuid();
        _plans.Setup(r => r.FirstOrDefaultAsync(It.IsAny<Expression<Func<ExamPlan, bool>>>(), default)).ReturnsAsync(MakePlan(5, courseId));

        var matchingGap = new ConceptGapDto("g1", "Recursion", "reason", "high", 3, true, false, new[] { courseId.ToString() }, "/x");
        var otherGap = new ConceptGapDto("g2", "Loops", "reason", "high", 3, true, false, new[] { Guid.NewGuid().ToString() }, "/y");
        var gaps = new KnowledgeGapsDto(new[] { matchingGap, otherGap }, new KnowledgeGapStatsDto(2, 2, 0, 0, 0));
        _mediator.Setup(m => m.Send(It.IsAny<GetKnowledgeGapsQuery>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(Result<KnowledgeGapsDto>.Success(gaps));

        var result = await _handler.Handle(new GetExamScheduleQuery(_planId, _userId), default);

        Assert.Contains(result.Data!.Days[0].Tasks, t => t.Type == "concept" && t.Title.Contains("Recursion"));
    }

    [Fact]
    public async Task Handle_NoGaps_FallsBackToGenericDeepReadTask()
    {
        _plans.Setup(r => r.FirstOrDefaultAsync(It.IsAny<Expression<Func<ExamPlan, bool>>>(), default)).ReturnsAsync(MakePlan(5));

        var result = await _handler.Handle(new GetExamScheduleQuery(_planId, _userId), default);

        Assert.Contains(result.Data!.Days[0].Tasks, t => t.Type == "concept" && t.Title.Contains("Deep-read"));
    }

    [Fact]
    public async Task Handle_DayMinutesSumToPlanDailyMinutes()
    {
        _plans.Setup(r => r.FirstOrDefaultAsync(It.IsAny<Expression<Func<ExamPlan, bool>>>(), default)).ReturnsAsync(MakePlan(5, dailyMinutes: 60));

        var result = await _handler.Handle(new GetExamScheduleQuery(_planId, _userId), default);

        Assert.All(result.Data!.Days.Where(d => d.Tasks.Count > 1), day => Assert.Equal(60, day.Minutes));
    }
}
