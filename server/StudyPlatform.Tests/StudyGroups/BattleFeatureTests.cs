using System.Linq.Expressions;
using System.Text.Json;
using Moq;
using StudyPlatform.Application.StudyGroups;
using StudyPlatform.Domain.Entities;
using StudyPlatform.Domain.Interfaces;
using Xunit;

namespace StudyPlatform.Tests.StudyGroups;

public class CreateBattleCommandHandlerTests
{
    private readonly Mock<IUnitOfWork> _uow = new();
    private readonly Mock<IStudyGroupMemberRepository> _members = new();
    private readonly Mock<IQuizRepository> _quizzes = new();
    private readonly Mock<IDocumentRepository> _documents = new();
    private readonly Mock<IVideoRepository> _videos = new();
    private readonly Mock<IQuizBattleRepository> _battles = new();
    private readonly CreateBattleCommandHandler _handler;
    private readonly Guid _userId = Guid.NewGuid();
    private readonly Guid _groupId = Guid.NewGuid();

    public CreateBattleCommandHandlerTests()
    {
        _uow.Setup(u => u.StudyGroupMembers).Returns(_members.Object);
        _uow.Setup(u => u.Quizzes).Returns(_quizzes.Object);
        _uow.Setup(u => u.Documents).Returns(_documents.Object);
        _uow.Setup(u => u.Videos).Returns(_videos.Object);
        _uow.Setup(u => u.QuizBattles).Returns(_battles.Object);
        _uow.Setup(u => u.SaveChangesAsync(default)).ReturnsAsync(1);
        _members.Setup(r => r.FindAsync(It.IsAny<Expression<Func<StudyGroupMember, bool>>>(), default))
            .ReturnsAsync(new[] { new StudyGroupMember { GroupId = _groupId, UserId = _userId } });
        _battles.Setup(r => r.AddAsync(It.IsAny<QuizBattle>(), default)).Returns(Task.CompletedTask);
        _handler = new CreateBattleCommandHandler(_uow.Object);
    }

    private static Quiz MakeQuiz(Guid userId, Guid? documentId = null, Guid? videoId = null) => new()
    {
        QuizId = Guid.NewGuid(),
        UserId = userId,
        DocumentId = documentId,
        VideoId = videoId,
        Question = "Q",
        OptionsJson = JsonSerializer.Serialize(new[] { "A", "B" }),
        CorrectAnswer = "A",
        Explanation = "E",
    };

    [Fact]
    public async Task Handle_NonMember_ReturnsFailure()
    {
        _members.Setup(r => r.FindAsync(It.IsAny<Expression<Func<StudyGroupMember, bool>>>(), default))
            .ReturnsAsync(Array.Empty<StudyGroupMember>());

        var result = await _handler.Handle(new CreateBattleCommand(_userId, _groupId, "Battle", null, 5), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("NOT_A_MEMBER", result.ErrorCode);
    }

    [Fact]
    public async Task Handle_NoQuizzes_ReturnsFailure()
    {
        _quizzes.Setup(r => r.FindAsync(It.IsAny<Expression<Func<Quiz, bool>>>(), default)).ReturnsAsync(Array.Empty<Quiz>());

        var result = await _handler.Handle(new CreateBattleCommand(_userId, _groupId, "Battle", null, 5), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("NO_QUESTIONS", result.ErrorCode);
    }

    [Fact]
    public async Task Handle_ClampsCountBetween3And20()
    {
        var quizzes = Enumerable.Range(0, 30).Select(_ => MakeQuiz(_userId)).ToList();
        _quizzes.Setup(r => r.FindAsync(It.IsAny<Expression<Func<Quiz, bool>>>(), default)).ReturnsAsync(quizzes);

        var tooMany = await _handler.Handle(new CreateBattleCommand(_userId, _groupId, "Battle", null, 100), default);
        Assert.Equal(20, tooMany.Data!.QuestionCount);

        var tooFew = await _handler.Handle(new CreateBattleCommand(_userId, _groupId, "Battle", null, 1), default);
        Assert.Equal(3, tooFew.Data!.QuestionCount);
    }

    [Fact]
    public async Task Handle_BlankTitle_DefaultsToGeneratedTitle()
    {
        var quizzes = Enumerable.Range(0, 5).Select(_ => MakeQuiz(_userId)).ToList();
        _quizzes.Setup(r => r.FindAsync(It.IsAny<Expression<Func<Quiz, bool>>>(), default)).ReturnsAsync(quizzes);

        var result = await _handler.Handle(new CreateBattleCommand(_userId, _groupId, "   ", null, 5), default);

        Assert.Contains("Quiz battle", result.Data!.Title);
    }

    [Fact]
    public async Task Handle_TrimsExplicitTitle()
    {
        var quizzes = Enumerable.Range(0, 5).Select(_ => MakeQuiz(_userId)).ToList();
        _quizzes.Setup(r => r.FindAsync(It.IsAny<Expression<Func<Quiz, bool>>>(), default)).ReturnsAsync(quizzes);

        var result = await _handler.Handle(new CreateBattleCommand(_userId, _groupId, "  My Battle  ", null, 5), default);

        Assert.Equal("My Battle", result.Data!.Title);
    }

    [Fact]
    public async Task Handle_CourseFilter_RestrictsToDocumentAndVideoQuizzesInThatCourse()
    {
        var courseId = Guid.NewGuid();
        var docId = Guid.NewGuid();
        var videoId = Guid.NewGuid();
        var quizzes = new List<Quiz>
        {
            MakeQuiz(_userId, documentId: docId),
            MakeQuiz(_userId, videoId: videoId),
            MakeQuiz(_userId, documentId: Guid.NewGuid()), // different course, excluded
        };
        _quizzes.Setup(r => r.FindAsync(It.IsAny<Expression<Func<Quiz, bool>>>(), default)).ReturnsAsync(quizzes);
        _documents.Setup(r => r.FindAsync(It.IsAny<Expression<Func<Document, bool>>>(), default))
            .ReturnsAsync(new[] { new Document { DocumentId = docId, UserId = _userId, CourseId = courseId } });
        _videos.Setup(r => r.FindAsync(It.IsAny<Expression<Func<Video, bool>>>(), default))
            .ReturnsAsync(new[] { new Video { VideoId = videoId, UserId = _userId, CourseId = courseId } });

        var result = await _handler.Handle(new CreateBattleCommand(_userId, _groupId, "Battle", courseId, 3), default);

        // Only 2 quizzes match the course filter, count clamps up to the 3 minimum but the source pool
        // is 2, so at most 2 questions can be snapshotted.
        Assert.True(result.IsSuccess);
        Assert.True(result.Data!.QuestionCount <= 2);
    }

    [Fact]
    public async Task Handle_MalformedOptionsJson_FallsBackToEmptyOptions()
    {
        var quiz = MakeQuiz(_userId);
        quiz.OptionsJson = "{not valid json";
        _quizzes.Setup(r => r.FindAsync(It.IsAny<Expression<Func<Quiz, bool>>>(), default)).ReturnsAsync(new[] { quiz });
        QuizBattle? captured = null;
        _battles.Setup(r => r.AddAsync(It.IsAny<QuizBattle>(), default))
            .Callback<QuizBattle, CancellationToken>((b, _) => captured = b)
            .Returns(Task.CompletedTask);

        var result = await _handler.Handle(new CreateBattleCommand(_userId, _groupId, "Battle", null, 3), default);

        Assert.True(result.IsSuccess);
        Assert.Contains("[]", captured!.QuestionsJson.Replace(" ", ""));
    }
}

public class GetGroupBattlesQueryHandlerTests
{
    private readonly Mock<IUnitOfWork> _uow = new();
    private readonly Mock<IStudyGroupMemberRepository> _members = new();
    private readonly Mock<IQuizBattleRepository> _battles = new();
    private readonly GetGroupBattlesQueryHandler _handler;
    private readonly Guid _userId = Guid.NewGuid();
    private readonly Guid _groupId = Guid.NewGuid();

    public GetGroupBattlesQueryHandlerTests()
    {
        _uow.Setup(u => u.StudyGroupMembers).Returns(_members.Object);
        _uow.Setup(u => u.QuizBattles).Returns(_battles.Object);
        _handler = new GetGroupBattlesQueryHandler(_uow.Object);
    }

    [Fact]
    public async Task Handle_NonMember_ReturnsFailure()
    {
        _members.Setup(r => r.FindAsync(It.IsAny<Expression<Func<StudyGroupMember, bool>>>(), default))
            .ReturnsAsync(Array.Empty<StudyGroupMember>());

        var result = await _handler.Handle(new GetGroupBattlesQuery(_userId, _groupId), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("NOT_A_MEMBER", result.ErrorCode);
    }

    [Fact]
    public async Task Handle_Member_RanksEntriesByScoreThenDuration()
    {
        _members.Setup(r => r.FindAsync(It.IsAny<Expression<Func<StudyGroupMember, bool>>>(), default))
            .ReturnsAsync(new[] { new StudyGroupMember { GroupId = _groupId, UserId = _userId } });

        var slow = new QuizBattleEntry { UserId = Guid.NewGuid(), Score = 5, Total = 5, DurationSeconds = 100, User = new User { FullName = "Slow" } };
        var fast = new QuizBattleEntry { UserId = _userId, Score = 5, Total = 5, DurationSeconds = 20, User = new User { FullName = "Fast" } };
        var loser = new QuizBattleEntry { UserId = Guid.NewGuid(), Score = 1, Total = 5, DurationSeconds = 5, User = new User { FullName = "Loser" } };
        var battle = new QuizBattle
        {
            QuizBattleId = Guid.NewGuid(),
            GroupId = _groupId,
            QuestionsJson = "[]",
            Entries = new List<QuizBattleEntry> { slow, fast, loser },
        };
        _battles.Setup(r => r.GetByGroupWithEntriesAsync(_groupId, default)).ReturnsAsync(new[] { battle });

        var result = await _handler.Handle(new GetGroupBattlesQuery(_userId, _groupId), default);

        var entries = result.Data!.Single().Entries;
        Assert.Equal("Fast", entries[0].Name); // same score, less time wins rank 1
        Assert.Equal("Slow", entries[1].Name);
        Assert.Equal("Loser", entries[2].Name);
        Assert.True(entries[0].IsMe);
    }
}

public class GetBattlePlayQueryHandlerTests
{
    private readonly Mock<IUnitOfWork> _uow = new();
    private readonly Mock<IStudyGroupMemberRepository> _members = new();
    private readonly Mock<IQuizBattleRepository> _battles = new();
    private readonly GetBattlePlayQueryHandler _handler;
    private readonly Guid _userId = Guid.NewGuid();
    private readonly Guid _battleId = Guid.NewGuid();
    private readonly Guid _groupId = Guid.NewGuid();

    public GetBattlePlayQueryHandlerTests()
    {
        _uow.Setup(u => u.StudyGroupMembers).Returns(_members.Object);
        _uow.Setup(u => u.QuizBattles).Returns(_battles.Object);
        _handler = new GetBattlePlayQueryHandler(_uow.Object);
    }

    [Fact]
    public async Task Handle_BattleNotFound_ReturnsFailure()
    {
        _battles.Setup(r => r.GetByIdWithEntriesAsync(_battleId, default)).ReturnsAsync((QuizBattle?)null);

        var result = await _handler.Handle(new GetBattlePlayQuery(_userId, _battleId), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("BATTLE_NOT_FOUND", result.ErrorCode);
    }

    [Fact]
    public async Task Handle_NonMember_ReturnsFailure()
    {
        _battles.Setup(r => r.GetByIdWithEntriesAsync(_battleId, default))
            .ReturnsAsync(new QuizBattle { QuizBattleId = _battleId, GroupId = _groupId, QuestionsJson = "[]" });
        _members.Setup(r => r.FindAsync(It.IsAny<Expression<Func<StudyGroupMember, bool>>>(), default))
            .ReturnsAsync(Array.Empty<StudyGroupMember>());

        var result = await _handler.Handle(new GetBattlePlayQuery(_userId, _battleId), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("NOT_A_MEMBER", result.ErrorCode);
    }

    [Fact]
    public async Task Handle_Member_ReturnsQuestionsWithoutTheCorrectAnswer()
    {
        var questionsJson = JsonSerializer.Serialize(new[]
        {
            new { Id = "q1", Question = "2+2?", Options = new[] { "3", "4" }, CorrectAnswer = "4", Explanation = "math" },
        });
        _battles.Setup(r => r.GetByIdWithEntriesAsync(_battleId, default))
            .ReturnsAsync(new QuizBattle { QuizBattleId = _battleId, GroupId = _groupId, QuestionsJson = questionsJson });
        _members.Setup(r => r.FindAsync(It.IsAny<Expression<Func<StudyGroupMember, bool>>>(), default))
            .ReturnsAsync(new[] { new StudyGroupMember { GroupId = _groupId, UserId = _userId } });

        var result = await _handler.Handle(new GetBattlePlayQuery(_userId, _battleId), default);

        Assert.True(result.IsSuccess);
        var question = Assert.Single(result.Data!.Questions);
        Assert.Equal("2+2?", question.Question);
        Assert.Equal(new[] { "3", "4" }, question.Options);
    }
}

public class SubmitBattleEntryCommandHandlerTests
{
    private readonly Mock<IUnitOfWork> _uow = new();
    private readonly Mock<IStudyGroupMemberRepository> _members = new();
    private readonly Mock<IQuizBattleRepository> _battles = new();
    private readonly SubmitBattleEntryCommandHandler _handler;
    private readonly Guid _userId = Guid.NewGuid();
    private readonly Guid _battleId = Guid.NewGuid();
    private readonly Guid _groupId = Guid.NewGuid();
    private readonly string _questionsJson = JsonSerializer.Serialize(new[]
    {
        new { Id = "q1", Question = "2+2?", Options = new[] { "3", "4" }, CorrectAnswer = "4", Explanation = "math" },
        new { Id = "q2", Question = "3+3?", Options = new[] { "6", "7" }, CorrectAnswer = "6", Explanation = "math" },
    });

    public SubmitBattleEntryCommandHandlerTests()
    {
        _uow.Setup(u => u.StudyGroupMembers).Returns(_members.Object);
        _uow.Setup(u => u.QuizBattles).Returns(_battles.Object);
        _uow.Setup(u => u.SaveChangesAsync(default)).ReturnsAsync(1);
        _members.Setup(r => r.FindAsync(It.IsAny<Expression<Func<StudyGroupMember, bool>>>(), default))
            .ReturnsAsync(new[] { new StudyGroupMember { GroupId = _groupId, UserId = _userId } });
        _battles.Setup(r => r.AddEntryAsync(It.IsAny<QuizBattleEntry>(), default)).Returns(Task.CompletedTask);
        _handler = new SubmitBattleEntryCommandHandler(_uow.Object);
    }

    private QuizBattle MakeBattle(string status = "open", IEnumerable<QuizBattleEntry>? entries = null) => new()
    {
        QuizBattleId = _battleId,
        GroupId = _groupId,
        QuestionsJson = _questionsJson,
        Status = status,
        Entries = (entries ?? Enumerable.Empty<QuizBattleEntry>()).ToList(),
    };

    [Fact]
    public async Task Handle_BattleNotFound_ReturnsFailure()
    {
        _battles.Setup(r => r.GetByIdWithEntriesAsync(_battleId, default)).ReturnsAsync((QuizBattle?)null);

        var result = await _handler.Handle(new SubmitBattleEntryCommand(_userId, _battleId, new(), 30), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("BATTLE_NOT_FOUND", result.ErrorCode);
    }

    [Fact]
    public async Task Handle_ClosedBattle_ReturnsFailure()
    {
        _battles.Setup(r => r.GetByIdWithEntriesAsync(_battleId, default)).ReturnsAsync(MakeBattle(status: "closed"));

        var result = await _handler.Handle(new SubmitBattleEntryCommand(_userId, _battleId, new(), 30), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("BATTLE_CLOSED", result.ErrorCode);
    }

    [Fact]
    public async Task Handle_AlreadyPlayed_ReturnsFailure()
    {
        var existingEntry = new QuizBattleEntry { UserId = _userId };
        _battles.Setup(r => r.GetByIdWithEntriesAsync(_battleId, default)).ReturnsAsync(MakeBattle(entries: new[] { existingEntry }));

        var result = await _handler.Handle(new SubmitBattleEntryCommand(_userId, _battleId, new(), 30), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("ALREADY_PLAYED", result.ErrorCode);
    }

    [Fact]
    public async Task Handle_ScoresCorrectAndIncorrectAnswers()
    {
        _battles.SetupSequence(r => r.GetByIdWithEntriesAsync(_battleId, default))
            .ReturnsAsync(MakeBattle())
            .ReturnsAsync(MakeBattle(entries: new[] { new QuizBattleEntry { UserId = _userId, Score = 1, Total = 2 } }));

        var answers = new Dictionary<string, string> { ["q1"] = "4", ["q2"] = "7" };
        var result = await _handler.Handle(new SubmitBattleEntryCommand(_userId, _battleId, answers, 45), default);

        Assert.True(result.IsSuccess);
        Assert.Equal(1, result.Data!.Score);
        Assert.Equal(2, result.Data.Total);
        Assert.True(result.Data.Items.Single(i => i.QuestionId == "q1").Correct);
        Assert.False(result.Data.Items.Single(i => i.QuestionId == "q2").Correct);
    }

    [Fact]
    public async Task Handle_MissingAnswerCountsAsIncorrect()
    {
        _battles.SetupSequence(r => r.GetByIdWithEntriesAsync(_battleId, default))
            .ReturnsAsync(MakeBattle())
            .ReturnsAsync(MakeBattle(entries: new[] { new QuizBattleEntry { UserId = _userId } }));

        var result = await _handler.Handle(new SubmitBattleEntryCommand(_userId, _battleId, new(), 45), default);

        Assert.Equal(0, result.Data!.Score);
    }

    [Fact]
    public async Task Handle_NegativeDuration_ClampsToZero()
    {
        _battles.SetupSequence(r => r.GetByIdWithEntriesAsync(_battleId, default))
            .ReturnsAsync(MakeBattle())
            .ReturnsAsync(MakeBattle(entries: new[] { new QuizBattleEntry { UserId = _userId } }));
        QuizBattleEntry? captured = null;
        _battles.Setup(r => r.AddEntryAsync(It.IsAny<QuizBattleEntry>(), default))
            .Callback<QuizBattleEntry, CancellationToken>((e, _) => captured = e)
            .Returns(Task.CompletedTask);

        await _handler.Handle(new SubmitBattleEntryCommand(_userId, _battleId, new(), -10), default);

        Assert.Equal(0, captured!.DurationSeconds);
    }
}
