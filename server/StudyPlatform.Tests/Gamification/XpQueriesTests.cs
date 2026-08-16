using System.Linq.Expressions;
using Moq;
using StudyPlatform.Application.Gamification;
using StudyPlatform.Domain.Entities;
using StudyPlatform.Domain.Interfaces;
using Xunit;

namespace StudyPlatform.Tests.Gamification;

public class XpMathTests
{
    [Theory]
    [InlineData(0, 1)]
    [InlineData(99, 1)]
    [InlineData(100, 2)]
    [InlineData(399, 2)]
    [InlineData(400, 3)]
    public void LevelFor_ComputesLevelFromQuadraticThresholds(int totalXp, int expectedLevel)
    {
        var (level, _, _) = XpMath.LevelFor(totalXp);
        Assert.Equal(expectedLevel, level);
    }

    [Fact]
    public void LevelFor_XpIntoLevelIsRelativeToLevelStart()
    {
        var (level, into, forNext) = XpMath.LevelFor(150);

        Assert.Equal(2, level);
        Assert.Equal(50, into); // 150 - 100*(2-1)^2 = 150-100 = 50
        Assert.Equal(300, forNext); // 100*2^2 - 100*1^2 = 400-100 = 300
    }

    [Fact]
    public void LevelFor_NegativeXp_StaysAtLevel1()
    {
        // The sqrt input clamps at 0, but `into` is totalXp minus level 1's start (0) — so a
        // negative Xp total (should not occur in practice) surfaces as negative `into` rather
        // than being clamped again.
        var (level, into, _) = XpMath.LevelFor(-50);

        Assert.Equal(1, level);
        Assert.Equal(-50, into);
    }
}

public class GetUserXpQueryHandlerTests
{
    private readonly Mock<IUnitOfWork> _uow = new();
    private readonly Mock<IStudySessionRepository> _sessions = new();
    private readonly Mock<IQuizSubmissionRepository> _submissions = new();
    private readonly Mock<IFlashcardSrsDataRepository> _srs = new();
    private readonly Mock<IGlossaryMasteredRepository> _mastered = new();
    private readonly GetUserXpQueryHandler _handler;
    private readonly Guid _userId = Guid.NewGuid();

    public GetUserXpQueryHandlerTests()
    {
        _uow.Setup(u => u.StudySessions).Returns(_sessions.Object);
        _uow.Setup(u => u.QuizSubmissions).Returns(_submissions.Object);
        _uow.Setup(u => u.FlashcardSrs).Returns(_srs.Object);
        _uow.Setup(u => u.GlossaryMastered).Returns(_mastered.Object);

        _sessions.Setup(r => r.FindAsNoTrackingAsync(It.IsAny<Expression<Func<StudySession, bool>>>(), default))
            .ReturnsAsync(Array.Empty<StudySession>());
        _submissions.Setup(r => r.FindAsNoTrackingAsync(It.IsAny<Expression<Func<QuizSubmission, bool>>>(), default))
            .ReturnsAsync(Array.Empty<QuizSubmission>());
        _srs.Setup(r => r.FindAsNoTrackingAsync(It.IsAny<Expression<Func<FlashcardSrsData, bool>>>(), default))
            .ReturnsAsync(Array.Empty<FlashcardSrsData>());
        _mastered.Setup(r => r.GetMasteredTermIdsByUserAsync(_userId, default)).ReturnsAsync(Array.Empty<Guid>());

        _handler = new GetUserXpQueryHandler(_uow.Object);
    }

    [Fact]
    public async Task Handle_NoActivity_ReturnsZeroXpAtLevel1()
    {
        var result = await _handler.Handle(new GetUserXpQuery(_userId), default);

        Assert.True(result.IsSuccess);
        Assert.Equal(0, result.Data!.TotalXp);
        Assert.Equal(1, result.Data.Level);
        Assert.Equal(0, result.Data.LevelProgress);
    }

    [Fact]
    public async Task Handle_AggregatesXpAcrossAllSources()
    {
        _sessions.Setup(r => r.FindAsNoTrackingAsync(It.IsAny<Expression<Func<StudySession, bool>>>(), default))
            .ReturnsAsync(new[] { new StudySession { UserId = _userId, DurationSeconds = 600 } }); // 10 min -> 10 xp
        _submissions.Setup(r => r.FindAsNoTrackingAsync(It.IsAny<Expression<Func<QuizSubmission, bool>>>(), default))
            .ReturnsAsync(new[] { new QuizSubmission { UserId = _userId, Score = 5 } }); // 5*2=10 xp
        _srs.Setup(r => r.FindAsNoTrackingAsync(It.IsAny<Expression<Func<FlashcardSrsData, bool>>>(), default))
            .ReturnsAsync(new[] { new FlashcardSrsData { UserId = _userId, Reps = 20 } }); // 20 xp
        _mastered.Setup(r => r.GetMasteredTermIdsByUserAsync(_userId, default)).ReturnsAsync(new[] { Guid.NewGuid(), Guid.NewGuid() }); // 2*5=10 xp

        var result = await _handler.Handle(new GetUserXpQuery(_userId), default);

        Assert.Equal(50, result.Data!.TotalXp);
        Assert.Equal(4, result.Data.Breakdown.Count);
    }
}

public class GetGroupLeaderboardQueryHandlerTests
{
    private readonly Mock<IUnitOfWork> _uow = new();
    private readonly Mock<IStudyGroupRepository> _groups = new();
    private readonly Mock<IStudySessionRepository> _sessions = new();
    private readonly Mock<IQuizSubmissionRepository> _submissions = new();
    private readonly GetGroupLeaderboardQueryHandler _handler;
    private readonly Guid _userId = Guid.NewGuid();
    private readonly Guid _groupId = Guid.NewGuid();

    public GetGroupLeaderboardQueryHandlerTests()
    {
        _uow.Setup(u => u.StudyGroups).Returns(_groups.Object);
        _uow.Setup(u => u.StudySessions).Returns(_sessions.Object);
        _uow.Setup(u => u.QuizSubmissions).Returns(_submissions.Object);
        _sessions.Setup(r => r.FindAsNoTrackingAsync(It.IsAny<Expression<Func<StudySession, bool>>>(), default))
            .ReturnsAsync(Array.Empty<StudySession>());
        _submissions.Setup(r => r.FindAsNoTrackingAsync(It.IsAny<Expression<Func<QuizSubmission, bool>>>(), default))
            .ReturnsAsync(Array.Empty<QuizSubmission>());
        _handler = new GetGroupLeaderboardQueryHandler(_uow.Object);
    }

    [Fact]
    public async Task Handle_GroupNotFound_ReturnsFailure()
    {
        _groups.Setup(r => r.GetWithMembersAsync(_groupId, default)).ReturnsAsync((StudyGroup?)null);

        var result = await _handler.Handle(new GetGroupLeaderboardQuery(_groupId, _userId), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("GROUP_NOT_FOUND", result.ErrorCode);
    }

    [Fact]
    public async Task Handle_NonMember_ReturnsFailure()
    {
        _groups.Setup(r => r.GetWithMembersAsync(_groupId, default))
            .ReturnsAsync(new StudyGroup { StudyGroupId = _groupId, Members = new List<StudyGroupMember>() });

        var result = await _handler.Handle(new GetGroupLeaderboardQuery(_groupId, _userId), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("NOT_A_MEMBER", result.ErrorCode);
    }

    [Fact]
    public async Task Handle_ClampsDaysBetween1And90()
    {
        _groups.Setup(r => r.GetWithMembersAsync(_groupId, default))
            .ReturnsAsync(new StudyGroup { StudyGroupId = _groupId, Members = new List<StudyGroupMember> { new() { UserId = _userId } } });

        var tooMany = await _handler.Handle(new GetGroupLeaderboardQuery(_groupId, _userId, 200), default);
        Assert.Equal(90, tooMany.Data!.Days);

        var tooFew = await _handler.Handle(new GetGroupLeaderboardQuery(_groupId, _userId, 0), default);
        Assert.Equal(1, tooFew.Data!.Days);
    }

    [Fact]
    public async Task Handle_RanksByXpThenMinutes()
    {
        var user1 = Guid.NewGuid();
        var user2 = _userId;
        var group = new StudyGroup
        {
            StudyGroupId = _groupId,
            Members = new List<StudyGroupMember>
            {
                new() { UserId = user1, User = new User { FullName = "High Score" } },
                new() { UserId = user2, User = new User { FullName = "Low Score" } },
            },
        };
        _groups.Setup(r => r.GetWithMembersAsync(_groupId, default)).ReturnsAsync(group);
        _submissions.Setup(r => r.FindAsNoTrackingAsync(It.IsAny<Expression<Func<QuizSubmission, bool>>>(), default))
            .ReturnsAsync(new[] { new QuizSubmission { UserId = user1, Score = 10 } });

        var result = await _handler.Handle(new GetGroupLeaderboardQuery(_groupId, _userId), default);

        Assert.Equal("High Score", result.Data!.Entries[0].Name);
        Assert.Equal(1, result.Data.Entries[0].Rank);
        Assert.False(result.Data.Entries[0].IsMe);
        Assert.True(result.Data.Entries[1].IsMe);
    }

    [Fact]
    public async Task Handle_MissingUserNavigation_FallsBackToMemberLabel()
    {
        var group = new StudyGroup
        {
            StudyGroupId = _groupId,
            Members = new List<StudyGroupMember> { new() { UserId = _userId, User = null! } },
        };
        _groups.Setup(r => r.GetWithMembersAsync(_groupId, default)).ReturnsAsync(group);

        var result = await _handler.Handle(new GetGroupLeaderboardQuery(_groupId, _userId), default);

        Assert.Equal("Member", result.Data!.Entries.Single().Name);
    }
}
