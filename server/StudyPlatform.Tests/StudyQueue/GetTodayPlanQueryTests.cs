using MediatR;
using Moq;
using StudyPlatform.Application.Analytics.DTOs;
using StudyPlatform.Application.Analytics.Queries;
using StudyPlatform.Application.Common;
using StudyPlatform.Application.ConceptLinks;
using StudyPlatform.Application.StudyQueue.DTOs;
using StudyPlatform.Application.StudyQueue.Queries;
using Xunit;

namespace StudyPlatform.Tests.StudyQueue;

public class GetTodayPlanQueryHandlerTests
{
    private readonly Mock<IMediator> _mediator = new();
    private readonly GetTodayPlanQueryHandler _handler;
    private readonly Guid _userId = Guid.NewGuid();

    public GetTodayPlanQueryHandlerTests()
    {
        SetupSummary(dailyGoal: 30, todayMinutes: 0);
        SetupRecommendations();
        SetupGaps();
        _handler = new GetTodayPlanQueryHandler(_mediator.Object);
    }

    private void SetupSummary(int dailyGoal, int todayMinutes, int dueFlashcards = 0)
    {
        var summary = new DashboardSummaryDto(new StudyStreakDto(0, 0, 0, todayMinutes), dueFlashcards, new ReinforcementCountsDto(0, 0, 0), dailyGoal);
        _mediator.Setup(m => m.Send(It.IsAny<GetDashboardSummaryQuery>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(Result<DashboardSummaryDto>.Success(summary));
    }

    private void SetupRecommendations(IEnumerable<RecommendationItemDto>? reviewQueue = null)
    {
        var dto = new RecommendationsDto(reviewQueue ?? Array.Empty<RecommendationItemDto>(), Array.Empty<RecommendationItemDto>(), DateTime.UtcNow);
        _mediator.Setup(m => m.Send(It.IsAny<Application.StudyQueue.Queries.GetRecommendationsQuery>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(Result<RecommendationsDto>.Success(dto));
    }

    private void SetupGaps(IEnumerable<ConceptGapDto>? gaps = null)
    {
        var dto = new KnowledgeGapsDto(gaps ?? Array.Empty<ConceptGapDto>(), new KnowledgeGapStatsDto(0, 0, 0, 0, 0));
        _mediator.Setup(m => m.Send(It.IsAny<GetKnowledgeGapsQuery>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(Result<KnowledgeGapsDto>.Success(dto));
    }

    [Fact]
    public async Task Handle_NoSignals_ReturnsEmptyPlan()
    {
        var result = await _handler.Handle(new GetTodayPlanQuery(_userId), default);

        Assert.True(result.IsSuccess);
        Assert.Empty(result.Data!.Items);
        Assert.Equal(0, result.Data.CompletionPercent);
        Assert.False(result.Data.GoalMet);
    }

    [Fact]
    public async Task Handle_FlashcardsAlwaysRankFirstRegardlessOfPriority()
    {
        SetupRecommendations(new[]
        {
            new RecommendationItemDto("quiz-1", "quiz", "Retry Quiz", "reason", 100, null, null, null, null),
            new RecommendationItemDto("cards-1", "flashcards", "Review cards", "reason", 10, null, null, null, 5),
        });

        var result = await _handler.Handle(new GetTodayPlanQuery(_userId), default);

        Assert.Equal("flashcards", result.Data!.Items.First().Type);
    }

    [Fact]
    public async Task Handle_OnlyHighSeverityGapsBecomeTasks()
    {
        SetupGaps(new[]
        {
            new ConceptGapDto("g1", "Medium gap", "reason", "medium", 1, true, false, Array.Empty<string>(), null),
            new ConceptGapDto("g2", "High gap", "reason", "high", 1, true, false, Array.Empty<string>(), "/x"),
        });

        var result = await _handler.Handle(new GetTodayPlanQuery(_userId), default);

        Assert.Single(result.Data!.Items);
        Assert.Contains("High gap", result.Data.Items.Single().Title);
    }

    [Fact]
    public async Task Handle_CapsGapsAtThree()
    {
        var gaps = Enumerable.Range(0, 5)
            .Select(i => new ConceptGapDto($"g{i}", $"Gap {i}", "reason", "high", 1, true, false, Array.Empty<string>(), null))
            .ToList();
        SetupGaps(gaps);

        var result = await _handler.Handle(new GetTodayPlanQuery(_userId), default);

        Assert.Equal(3, result.Data!.Items.Count());
    }

    [Fact]
    public async Task Handle_CapsTotalItemsAtEight()
    {
        var recs = Enumerable.Range(0, 10)
            .Select(i => new RecommendationItemDto($"r{i}", "quiz", $"Quiz {i}", "reason", 50 - i, null, null, null, null))
            .ToList();
        SetupRecommendations(recs);

        var result = await _handler.Handle(new GetTodayPlanQuery(_userId), default);

        Assert.Equal(8, result.Data!.Items.Count());
    }

    [Fact]
    public async Task Handle_FirstItemAlwaysCore_EvenIfItExceedsBudget()
    {
        SetupSummary(dailyGoal: 30, todayMinutes: 30); // remaining = 0 -> budget falls back to min(goal,15) = 15
        SetupRecommendations(new[]
        {
            new RecommendationItemDto("course-1", "course", "Strengthen X", "reason", 90, null, null, null, null), // 10 min
        });

        var result = await _handler.Handle(new GetTodayPlanQuery(_userId), default);

        Assert.False(result.Data!.Items.First().Stretch);
    }

    [Fact]
    public async Task Handle_ItemsBeyondBudget_AreMarkedStretch()
    {
        SetupSummary(dailyGoal: 10, todayMinutes: 0); // budget = 10
        SetupRecommendations(new[]
        {
            new RecommendationItemDto("course-1", "course", "First", "reason", 90, null, null, null, null), // 10 min, core
            new RecommendationItemDto("course-2", "course", "Second", "reason", 80, null, null, null, null), // pushes past budget
        });

        var result = await _handler.Handle(new GetTodayPlanQuery(_userId), default);

        var items = result.Data!.Items.ToList();
        Assert.False(items[0].Stretch);
        Assert.True(items[1].Stretch);
    }

    [Fact]
    public async Task Handle_PlannedMinutesOnlySumsCoreItems()
    {
        SetupSummary(dailyGoal: 10, todayMinutes: 0);
        SetupRecommendations(new[]
        {
            new RecommendationItemDto("course-1", "course", "First", "reason", 90, null, null, null, null), // 10 min core
            new RecommendationItemDto("course-2", "course", "Second", "reason", 80, null, null, null, null), // stretch
        });

        var result = await _handler.Handle(new GetTodayPlanQuery(_userId), default);

        Assert.Equal(10, result.Data!.PlannedMinutes);
    }

    [Fact]
    public async Task Handle_GoalMetWhenTodayMinutesReachesGoal()
    {
        SetupSummary(dailyGoal: 30, todayMinutes: 30);

        var result = await _handler.Handle(new GetTodayPlanQuery(_userId), default);

        Assert.True(result.Data!.GoalMet);
        Assert.Equal(100, result.Data.CompletionPercent);
    }

    [Fact]
    public async Task Handle_ZeroDailyGoal_CompletionIsZeroNotDivideByZero()
    {
        SetupSummary(dailyGoal: 0, todayMinutes: 0);

        var result = await _handler.Handle(new GetTodayPlanQuery(_userId), default);

        Assert.Equal(0, result.Data!.CompletionPercent);
        Assert.False(result.Data.GoalMet);
    }

    [Theory]
    [InlineData("flashcards", 10, 2)]
    [InlineData("glossary", 10, 3)]
    [InlineData("problems", 2, 4)]
    [InlineData("quiz", null, 5)]
    [InlineData("material", null, 8)]
    public async Task Handle_EstimatesMinutesPerType(string type, int? count, int expectedMinutes)
    {
        SetupRecommendations(new[] { new RecommendationItemDto("r1", type, "T", "reason", 90, null, null, null, count) });

        var result = await _handler.Handle(new GetTodayPlanQuery(_userId), default);

        Assert.Equal(expectedMinutes, result.Data!.Items.Single().EstimatedMinutes);
    }
}
