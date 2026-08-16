using System.Linq.Expressions;
using MediatR;
using Moq;
using StudyPlatform.Application.Analytics.DTOs;
using StudyPlatform.Application.Analytics.Queries;
using StudyPlatform.Application.Common;
using StudyPlatform.Application.ConceptLinks;
using StudyPlatform.Application.Gamification;
using StudyPlatform.Domain.Entities;
using StudyPlatform.Domain.Interfaces;
using Xunit;

namespace StudyPlatform.Tests.Gamification;

public class GetWeeklyDigestQueryHandlerTests
{
    private readonly Mock<IUnitOfWork> _uow = new();
    private readonly Mock<IStudySessionRepository> _sessions = new();
    private readonly Mock<IFlashcardSrsDataRepository> _srs = new();
    private readonly Mock<IQuizSubmissionRepository> _submissions = new();
    private readonly Mock<IDocumentRepository> _documents = new();
    private readonly Mock<IVideoRepository> _videos = new();
    private readonly Mock<IMistakeEntryRepository> _mistakes = new();
    private readonly Mock<IMediator> _mediator = new();
    private readonly GetWeeklyDigestQueryHandler _handler;
    private readonly Guid _userId = Guid.NewGuid();

    public GetWeeklyDigestQueryHandlerTests()
    {
        _uow.Setup(u => u.StudySessions).Returns(_sessions.Object);
        _uow.Setup(u => u.FlashcardSrs).Returns(_srs.Object);
        _uow.Setup(u => u.QuizSubmissions).Returns(_submissions.Object);
        _uow.Setup(u => u.Documents).Returns(_documents.Object);
        _uow.Setup(u => u.Videos).Returns(_videos.Object);
        _uow.Setup(u => u.MistakeEntries).Returns(_mistakes.Object);

        _sessions.Setup(r => r.FindAsNoTrackingAsync(It.IsAny<Expression<Func<StudySession, bool>>>(), default))
            .ReturnsAsync(Array.Empty<StudySession>());
        _srs.Setup(r => r.CountAsync(It.IsAny<Expression<Func<FlashcardSrsData, bool>>>(), default)).ReturnsAsync(0);
        _submissions.Setup(r => r.FindAsNoTrackingAsync(It.IsAny<Expression<Func<QuizSubmission, bool>>>(), default))
            .ReturnsAsync(Array.Empty<QuizSubmission>());
        _documents.Setup(r => r.CountAsync(It.IsAny<Expression<Func<Document, bool>>>(), default)).ReturnsAsync(0);
        _videos.Setup(r => r.CountAsync(It.IsAny<Expression<Func<Video, bool>>>(), default)).ReturnsAsync(0);
        _mistakes.Setup(r => r.CountAsync(It.IsAny<Expression<Func<MistakeEntry, bool>>>(), default)).ReturnsAsync(0);

        SetupSummary(currentStreak: 0);
        SetupGaps();

        _handler = new GetWeeklyDigestQueryHandler(_uow.Object, _mediator.Object);
    }

    private void SetupSummary(int currentStreak)
    {
        var summary = new DashboardSummaryDto(new StudyStreakDto(currentStreak, currentStreak, 0, 0), 0, new ReinforcementCountsDto(0, 0, 0), 30);
        _mediator.Setup(m => m.Send(It.IsAny<GetDashboardSummaryQuery>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(Result<DashboardSummaryDto>.Success(summary));
    }

    private void SetupGaps(IEnumerable<ConceptGapDto>? gaps = null)
    {
        var dto = new KnowledgeGapsDto(gaps ?? Array.Empty<ConceptGapDto>(), new KnowledgeGapStatsDto(0, 0, 0, 0, 0));
        _mediator.Setup(m => m.Send(It.IsAny<GetKnowledgeGapsQuery>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(Result<KnowledgeGapsDto>.Success(dto));
    }

    [Fact]
    public async Task Handle_NoActivity_HeadlineIsQuietWeek()
    {
        var result = await _handler.Handle(new GetWeeklyDigestQuery(_userId), default);

        Assert.True(result.IsSuccess);
        Assert.Contains("Quiet week", result.Data!.Headline);
    }

    [Fact]
    public async Task Handle_ProducesExactly7DaysOfDailyMinutes()
    {
        var result = await _handler.Handle(new GetWeeklyDigestQuery(_userId), default);

        Assert.Equal(7, result.Data!.DailyMinutes.Count);
    }

    [Fact]
    public async Task Handle_SumsStudyMinutesAcrossSessions()
    {
        var today = DateTime.UtcNow.Date;
        _sessions.Setup(r => r.FindAsNoTrackingAsync(It.IsAny<Expression<Func<StudySession, bool>>>(), default))
            .ReturnsAsync(new[]
            {
                new StudySession { UserId = _userId, OccurredAt = today, DurationSeconds = 600 },
                new StudySession { UserId = _userId, OccurredAt = today, DurationSeconds = 300 },
            });

        var result = await _handler.Handle(new GetWeeklyDigestQuery(_userId), default);

        Assert.Equal(15, result.Data!.StudyMinutes);
        Assert.Equal(1, result.Data.ActiveDays);
    }

    [Fact]
    public async Task Handle_QuizAccuracyComputedFromCorrectOverTotal()
    {
        _submissions.Setup(r => r.FindAsNoTrackingAsync(It.IsAny<Expression<Func<QuizSubmission, bool>>>(), default))
            .ReturnsAsync(new[] { new QuizSubmission { UserId = _userId, Score = 3, Total = 4 } });

        var result = await _handler.Handle(new GetWeeklyDigestQuery(_userId), default);

        Assert.Equal(75.0, result.Data!.QuizAccuracy);
    }

    [Fact]
    public async Task Handle_ZeroQuizTotal_AccuracyIsZeroNotDivideByZero()
    {
        var result = await _handler.Handle(new GetWeeklyDigestQuery(_userId), default);

        Assert.Equal(0, result.Data!.QuizAccuracy);
    }

    [Fact]
    public async Task Handle_NewMaterialsCombinesDocumentsAndVideos()
    {
        _documents.Setup(r => r.CountAsync(It.IsAny<Expression<Func<Document, bool>>>(), default)).ReturnsAsync(3);
        _videos.Setup(r => r.CountAsync(It.IsAny<Expression<Func<Video, bool>>>(), default)).ReturnsAsync(2);

        var result = await _handler.Handle(new GetWeeklyDigestQuery(_userId), default);

        Assert.Equal(5, result.Data!.NewMaterials);
    }

    [Fact]
    public async Task Handle_TopGapTakenFromFirstGap()
    {
        SetupGaps(new[] { new ConceptGapDto("g1", "Recursion", "hard to grasp", "high", 3, true, false, Array.Empty<string>(), null) });

        var result = await _handler.Handle(new GetWeeklyDigestQuery(_userId), default);

        Assert.Equal("Recursion", result.Data!.TopGapConcept);
        Assert.Equal("hard to grasp", result.Data.TopGapReason);
    }

    [Fact]
    public async Task Handle_HighActiveDays_HeadlinePraisesConsistency()
    {
        var sessions = Enumerable.Range(0, 6)
            .Select(i => new StudySession { UserId = _userId, OccurredAt = DateTime.UtcNow.Date.AddDays(-i), DurationSeconds = 600 })
            .ToArray();
        _sessions.Setup(r => r.FindAsNoTrackingAsync(It.IsAny<Expression<Func<StudySession, bool>>>(), default)).ReturnsAsync(sessions);

        var result = await _handler.Handle(new GetWeeklyDigestQuery(_userId), default);

        Assert.Contains("Outstanding consistency", result.Data!.Headline);
    }

    [Fact]
    public async Task Handle_LongStreakWithoutHighActiveDays_HeadlineMentionsStreak()
    {
        var today = DateTime.UtcNow.Date;
        _sessions.Setup(r => r.FindAsNoTrackingAsync(It.IsAny<Expression<Func<StudySession, bool>>>(), default))
            .ReturnsAsync(new[] { new StudySession { UserId = _userId, OccurredAt = today, DurationSeconds = 60 } });
        SetupSummary(currentStreak: 10);

        var result = await _handler.Handle(new GetWeeklyDigestQuery(_userId), default);

        Assert.Contains("10-day streak", result.Data!.Headline);
    }

    [Fact]
    public async Task Handle_WeeklyXpCombinesStudyQuizAndReviews()
    {
        var today = DateTime.UtcNow.Date;
        _sessions.Setup(r => r.FindAsNoTrackingAsync(It.IsAny<Expression<Func<StudySession, bool>>>(), default))
            .ReturnsAsync(new[] { new StudySession { UserId = _userId, OccurredAt = today, DurationSeconds = 600 } }); // 10 xp
        _submissions.Setup(r => r.FindAsNoTrackingAsync(It.IsAny<Expression<Func<QuizSubmission, bool>>>(), default))
            .ReturnsAsync(new[] { new QuizSubmission { UserId = _userId, Score = 4, Total = 4 } }); // 8 xp
        _srs.Setup(r => r.CountAsync(It.IsAny<Expression<Func<FlashcardSrsData, bool>>>(), default)).ReturnsAsync(5); // 5 xp

        var result = await _handler.Handle(new GetWeeklyDigestQuery(_userId), default);

        Assert.Equal(23, result.Data!.WeeklyXp);
    }
}
