using System.Linq.Expressions;
using System.Text.Json;
using Moq;
using StudyPlatform.Application.Planner;
using StudyPlatform.Domain.Entities;
using StudyPlatform.Domain.Interfaces;
using Xunit;

namespace StudyPlatform.Tests.Planner;

public class GetMockExamQueryHandlerTests
{
    private readonly Mock<IUnitOfWork> _uow = new();
    private readonly Mock<IQuizRepository> _quizzes = new();
    private readonly Mock<IDocumentRepository> _documents = new();
    private readonly Mock<IVideoRepository> _videos = new();
    private readonly GetMockExamQueryHandler _handler;
    private readonly Guid _userId = Guid.NewGuid();

    public GetMockExamQueryHandlerTests()
    {
        _uow.Setup(u => u.Quizzes).Returns(_quizzes.Object);
        _uow.Setup(u => u.Documents).Returns(_documents.Object);
        _uow.Setup(u => u.Videos).Returns(_videos.Object);
        _handler = new GetMockExamQueryHandler(_uow.Object);
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
    };

    [Fact]
    public async Task Handle_NoQuizzes_ReturnsFailure()
    {
        _quizzes.Setup(r => r.FindAsync(It.IsAny<Expression<Func<Quiz, bool>>>(), default)).ReturnsAsync(Array.Empty<Quiz>());

        var result = await _handler.Handle(new GetMockExamQuery(_userId, null, 10), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("NO_QUESTIONS", result.ErrorCode);
    }

    [Fact]
    public async Task Handle_ClampsCountBetween3And50()
    {
        var quizzes = Enumerable.Range(0, 60).Select(_ => MakeQuiz(_userId)).ToList();
        _quizzes.Setup(r => r.FindAsync(It.IsAny<Expression<Func<Quiz, bool>>>(), default)).ReturnsAsync(quizzes);

        var tooMany = await _handler.Handle(new GetMockExamQuery(_userId, null, 100), default);
        Assert.Equal(50, tooMany.Data!.Questions.Count);

        var tooFew = await _handler.Handle(new GetMockExamQuery(_userId, null, 1), default);
        Assert.Equal(3, tooFew.Data!.Questions.Count);
    }

    [Fact]
    public async Task Handle_SuggestedMinutesRoundsUpToNearest5()
    {
        var quizzes = Enumerable.Range(0, 3).Select(_ => MakeQuiz(_userId)).ToList();
        _quizzes.Setup(r => r.FindAsync(It.IsAny<Expression<Func<Quiz, bool>>>(), default)).ReturnsAsync(quizzes);

        var result = await _handler.Handle(new GetMockExamQuery(_userId, null, 3), default);

        // 3 questions * 1.5s = 4.5 -> ceil / 5 * 5 = 5
        Assert.Equal(5, result.Data!.SuggestedMinutes);
    }

    [Fact]
    public async Task Handle_MalformedOptionsJson_FallsBackToEmpty()
    {
        var quiz = MakeQuiz(_userId);
        quiz.OptionsJson = "{not json";
        _quizzes.Setup(r => r.FindAsync(It.IsAny<Expression<Func<Quiz, bool>>>(), default)).ReturnsAsync(new[] { quiz });

        var result = await _handler.Handle(new GetMockExamQuery(_userId, null, 3), default);

        Assert.Empty(result.Data!.Questions.Single().Options);
    }

    [Fact]
    public async Task Handle_CourseFilter_OnlyIncludesQuizzesInThatCourse()
    {
        var courseId = Guid.NewGuid();
        var docId = Guid.NewGuid();
        var quizzes = new List<Quiz>
        {
            MakeQuiz(_userId, documentId: docId),
            MakeQuiz(_userId, documentId: Guid.NewGuid()),
        };
        _quizzes.Setup(r => r.FindAsync(It.IsAny<Expression<Func<Quiz, bool>>>(), default)).ReturnsAsync(quizzes);
        _documents.Setup(r => r.FindAsync(It.IsAny<Expression<Func<Document, bool>>>(), default))
            .ReturnsAsync(new[] { new Document { DocumentId = docId, UserId = _userId, CourseId = courseId } });
        _videos.Setup(r => r.FindAsync(It.IsAny<Expression<Func<Video, bool>>>(), default)).ReturnsAsync(Array.Empty<Video>());

        var result = await _handler.Handle(new GetMockExamQuery(_userId, courseId, 3), default);

        Assert.True(result.IsSuccess);
        Assert.True(result.Data!.Questions.Count <= 1);
    }
}

public class GradeMockExamCommandHandlerTests
{
    private readonly Mock<IUnitOfWork> _uow = new();
    private readonly Mock<IQuizRepository> _quizzes = new();
    private readonly Mock<IMistakeEntryRepository> _mistakes = new();
    private readonly GradeMockExamCommandHandler _handler;
    private readonly Guid _userId = Guid.NewGuid();

    public GradeMockExamCommandHandlerTests()
    {
        _uow.Setup(u => u.Quizzes).Returns(_quizzes.Object);
        _uow.Setup(u => u.MistakeEntries).Returns(_mistakes.Object);
        _uow.Setup(u => u.SaveChangesAsync(default)).ReturnsAsync(1);
        _mistakes.Setup(r => r.FindAsync(It.IsAny<Expression<Func<MistakeEntry, bool>>>(), default)).ReturnsAsync(Array.Empty<MistakeEntry>());
        _mistakes.Setup(r => r.AddAsync(It.IsAny<MistakeEntry>(), default)).Returns(Task.CompletedTask);
        _handler = new GradeMockExamCommandHandler(_uow.Object);
    }

    [Fact]
    public async Task Handle_NoAnswers_ReturnsFailure()
    {
        var result = await _handler.Handle(new GradeMockExamCommand(_userId, new(), 60), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("NO_ANSWERS", result.ErrorCode);
    }

    [Fact]
    public async Task Handle_ScoresCorrectAndIncorrectAnswers()
    {
        var quiz1 = new Quiz { QuizId = Guid.NewGuid(), UserId = _userId, Question = "Q1", CorrectAnswer = "A" };
        var quiz2 = new Quiz { QuizId = Guid.NewGuid(), UserId = _userId, Question = "Q2", CorrectAnswer = "B" };
        _quizzes.Setup(r => r.FindAsync(It.IsAny<Expression<Func<Quiz, bool>>>(), default)).ReturnsAsync(new[] { quiz1, quiz2 });

        var answers = new Dictionary<string, string> { [quiz1.QuizId.ToString()] = "A", [quiz2.QuizId.ToString()] = "wrong" };
        var result = await _handler.Handle(new GradeMockExamCommand(_userId, answers, 60), default);

        Assert.True(result.IsSuccess);
        Assert.Equal(1, result.Data!.Score);
        Assert.Equal(2, result.Data.Total);
    }

    [Fact]
    public async Task Handle_IgnoresNonGuidAnswerKeys()
    {
        _quizzes.Setup(r => r.FindAsync(It.IsAny<Expression<Func<Quiz, bool>>>(), default)).ReturnsAsync(Array.Empty<Quiz>());

        var answers = new Dictionary<string, string> { ["not-a-guid"] = "A" };
        var result = await _handler.Handle(new GradeMockExamCommand(_userId, answers, 60), default);

        Assert.True(result.IsSuccess);
        Assert.Empty(result.Data!.Items);
    }

    [Fact]
    public async Task Handle_WrongAnswer_CreatesMistakeEntry()
    {
        var quiz = new Quiz { QuizId = Guid.NewGuid(), UserId = _userId, Question = "Q1", CorrectAnswer = "A" };
        _quizzes.Setup(r => r.FindAsync(It.IsAny<Expression<Func<Quiz, bool>>>(), default)).ReturnsAsync(new[] { quiz });
        var answers = new Dictionary<string, string> { [quiz.QuizId.ToString()] = "wrong" };

        await _handler.Handle(new GradeMockExamCommand(_userId, answers, 60), default);

        _mistakes.Verify(r => r.AddAsync(It.IsAny<MistakeEntry>(), default), Times.Once);
    }
}
