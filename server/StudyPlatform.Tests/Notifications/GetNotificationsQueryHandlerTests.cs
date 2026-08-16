using MediatR;
using Moq;
using StudyPlatform.Application.Analytics.DTOs;
using StudyPlatform.Application.Analytics.Queries;
using StudyPlatform.Application.Classrooms;
using StudyPlatform.Application.Common;
using StudyPlatform.Application.ConceptLinks;
using StudyPlatform.Application.Notifications;
using StudyPlatform.Application.StudyQueue.DTOs;
using StudyPlatform.Application.StudyQueue.Queries;
using Xunit;

namespace StudyPlatform.Tests.Notifications;

public class GetNotificationsQueryHandlerTests
{
    private readonly Mock<IMediator> _mediator = new();
    private readonly GetNotificationsQueryHandler _handler;
    private readonly Guid _userId = Guid.NewGuid();

    public GetNotificationsQueryHandlerTests()
    {
        SetupSummary(dueFlashcards: 0, currentStreak: 0, todaySeconds: 0, todayMinutes: 0, dailyGoal: 30);
        SetupDeadlines();
        SetupGaps();
        SetupRecommendations();

        _handler = new GetNotificationsQueryHandler(_mediator.Object);
    }

    private void SetupSummary(int dueFlashcards, int currentStreak, int todaySeconds, int todayMinutes, int dailyGoal)
    {
        var summary = new DashboardSummaryDto(
            new StudyStreakDto(currentStreak, currentStreak, todaySeconds, todayMinutes),
            dueFlashcards, new ReinforcementCountsDto(0, 0, 0), dailyGoal);
        _mediator.Setup(m => m.Send(It.IsAny<GetDashboardSummaryQuery>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(Result<DashboardSummaryDto>.Success(summary));
    }

    private void SetupDeadlines(IReadOnlyList<ClassroomDeadlineDto>? deadlines = null)
    {
        _mediator.Setup(m => m.Send(It.IsAny<GetClassroomDeadlinesQuery>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(Result<IReadOnlyList<ClassroomDeadlineDto>>.Success(deadlines ?? Array.Empty<ClassroomDeadlineDto>()));
    }

    private void SetupGaps(IEnumerable<ConceptGapDto>? gaps = null)
    {
        var dto = new KnowledgeGapsDto(gaps ?? Array.Empty<ConceptGapDto>(), new KnowledgeGapStatsDto(0, 0, 0, 0, 0));
        _mediator.Setup(m => m.Send(It.IsAny<GetKnowledgeGapsQuery>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(Result<KnowledgeGapsDto>.Success(dto));
    }

    private void SetupRecommendations(IEnumerable<RecommendationItemDto>? reviewQueue = null)
    {
        var dto = new RecommendationsDto(reviewQueue ?? Array.Empty<RecommendationItemDto>(), Array.Empty<RecommendationItemDto>(), DateTime.UtcNow);
        _mediator.Setup(m => m.Send(It.IsAny<GetRecommendationsQuery>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(Result<RecommendationsDto>.Success(dto));
    }

    [Fact]
    public async Task Handle_NoSignals_ReturnsEmptyList()
    {
        var result = await _handler.Handle(new GetNotificationsQuery(_userId), default);

        Assert.True(result.IsSuccess);
        Assert.Empty(result.Data!.Items);
        Assert.Equal(0, result.Data.Count);
    }

    [Fact]
    public async Task Handle_DueFlashcards_AddsDueNotification()
    {
        SetupSummary(dueFlashcards: 5, currentStreak: 0, todaySeconds: 60, todayMinutes: 5, dailyGoal: 30);

        var result = await _handler.Handle(new GetNotificationsQuery(_userId), default);

        Assert.Contains(result.Data!.Items, i => i.Id == "due-flashcards" && i.Title.Contains("5 cards"));
    }

    [Fact]
    public async Task Handle_StreakAtRiskOnlyWhenNothingStudiedToday()
    {
        SetupSummary(dueFlashcards: 0, currentStreak: 3, todaySeconds: 0, todayMinutes: 0, dailyGoal: 30);

        var result = await _handler.Handle(new GetNotificationsQuery(_userId), default);

        Assert.Contains(result.Data!.Items, i => i.Id == "streak-risk");
    }

    [Fact]
    public async Task Handle_NoStreakRiskWhenAlreadyStudiedToday()
    {
        SetupSummary(dueFlashcards: 0, currentStreak: 3, todaySeconds: 60, todayMinutes: 5, dailyGoal: 30);

        var result = await _handler.Handle(new GetNotificationsQuery(_userId), default);

        Assert.DoesNotContain(result.Data!.Items, i => i.Id == "streak-risk");
    }

    [Fact]
    public async Task Handle_GoalRemaining_OnlyWhenStartedButNotFinished()
    {
        SetupSummary(dueFlashcards: 0, currentStreak: 0, todaySeconds: 60, todayMinutes: 10, dailyGoal: 30);

        var result = await _handler.Handle(new GetNotificationsQuery(_userId), default);

        Assert.Contains(result.Data!.Items, i => i.Id == "goal-remaining" && i.Title.Contains("20 min"));
    }

    [Fact]
    public async Task Handle_GoalAlreadyMet_NoGoalNotification()
    {
        SetupSummary(dueFlashcards: 0, currentStreak: 0, todaySeconds: 60, todayMinutes: 30, dailyGoal: 30);

        var result = await _handler.Handle(new GetNotificationsQuery(_userId), default);

        Assert.DoesNotContain(result.Data!.Items, i => i.Id == "goal-remaining");
    }

    [Fact]
    public async Task Handle_OverdueClassroomDeadline_LabeledOverdue()
    {
        SetupDeadlines(new[]
        {
            new ClassroomDeadlineDto(Guid.NewGuid(), "CS 101", Guid.NewGuid(), null, "Essay", DateTime.UtcNow.AddDays(-1), "assigned", true),
        });

        var result = await _handler.Handle(new GetNotificationsQuery(_userId), default);

        Assert.Contains(result.Data!.Items, i => i.Title.StartsWith("Overdue:"));
    }

    [Fact]
    public async Task Handle_ClassroomDeadlines_CappedAtThree()
    {
        var deadlines = Enumerable.Range(0, 5)
            .Select(i => new ClassroomDeadlineDto(Guid.NewGuid(), "CS 101", Guid.NewGuid(), null, $"Task {i}", DateTime.UtcNow.AddDays(1), "assigned", false))
            .ToList();
        SetupDeadlines(deadlines);

        var result = await _handler.Handle(new GetNotificationsQuery(_userId), default);

        Assert.Equal(3, result.Data!.Items.Count(i => i.Type == "due" && i.Id.StartsWith("classroom-")));
    }

    [Fact]
    public async Task Handle_OnlyHighSeverityGapSurfaces()
    {
        SetupGaps(new[]
        {
            new ConceptGapDto("g1", "Recursion", "reason", "medium", 1, true, false, Array.Empty<string>(), null),
            new ConceptGapDto("g2", "Loops", "reason", "high", 3, true, false, Array.Empty<string>(), "/x"),
        });

        var result = await _handler.Handle(new GetNotificationsQuery(_userId), default);

        var gapNotification = Assert.Single(result.Data!.Items, i => i.Type == "gap");
        Assert.Contains("Loops", gapNotification.Title);
    }

    [Fact]
    public async Task Handle_ReviewRecommendations_ExcludeFlashcardsTypeAndCapAtTwo()
    {
        SetupRecommendations(new[]
        {
            new RecommendationItemDto("r1", "flashcards", "Flashcards", "reason", 90, null, null, null, null),
            new RecommendationItemDto("r2", "quiz", "Quiz 1", "reason", 80, null, null, null, null),
            new RecommendationItemDto("r3", "quiz", "Quiz 2", "reason", 70, null, null, null, null),
            new RecommendationItemDto("r4", "glossary", "Glossary", "reason", 60, null, null, null, null),
        });

        var result = await _handler.Handle(new GetNotificationsQuery(_userId), default);

        var reviewItems = result.Data!.Items.Where(i => i.Type == "review").ToList();
        Assert.Equal(2, reviewItems.Count);
        Assert.DoesNotContain(reviewItems, i => i.Title == "Flashcards");
    }
}
