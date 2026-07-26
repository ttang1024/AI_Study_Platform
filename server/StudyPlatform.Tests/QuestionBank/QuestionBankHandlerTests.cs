using System.Linq.Expressions;
using Moq;
using StudyPlatform.Application.QuestionBank;
using StudyPlatform.Domain.Entities;
using StudyPlatform.Domain.Interfaces;
using Xunit;

namespace StudyPlatform.Tests.QuestionBank;

// ─── DeleteQuestionBankQuestionCommand ─────────────────────────────────────────

public class DeleteQuestionBankQuestionCommandHandlerTests
{
    private readonly Mock<IUnitOfWork> _uow = new();
    private readonly Mock<IQuizRepository> _quizzes = new();
    private readonly DeleteQuestionBankQuestionCommandHandler _handler;
    private readonly Guid _userId = Guid.NewGuid();

    public DeleteQuestionBankQuestionCommandHandlerTests()
    {
        _uow.Setup(u => u.Quizzes).Returns(_quizzes.Object);
        _uow.Setup(u => u.SaveChangesAsync(default)).ReturnsAsync(1);
        _handler = new DeleteQuestionBankQuestionCommandHandler(_uow.Object);
    }

    private Quiz MakeQuiz(Guid? userId = null) => new()
    {
        QuizId = Guid.NewGuid(),
        UserId = userId ?? _userId,
        Question = "What is X?",
        OptionsJson = "[\"A\",\"B\",\"C\",\"D\"]",
        CorrectAnswer = "A",
        Explanation = "Because.",
        Difficulty = "medium",
        CreatedAt = DateTime.UtcNow,
    };

    [Fact]
    public async Task Handle_OwnedQuestion_DeletesAndReturnsSuccess()
    {
        var quiz = MakeQuiz();
        _quizzes.Setup(r => r.GetByIdAsync(quiz.QuizId, default)).ReturnsAsync(quiz);

        var result = await _handler.Handle(new DeleteQuestionBankQuestionCommand(_userId, quiz.QuizId), default);

        Assert.True(result.IsSuccess);
        _quizzes.Verify(r => r.Remove(quiz), Times.Once);
        _uow.Verify(u => u.SaveChangesAsync(default), Times.Once);
    }

    [Fact]
    public async Task Handle_QuestionNotFound_ReturnsFailure()
    {
        _quizzes.Setup(r => r.GetByIdAsync(It.IsAny<Guid>(), default)).ReturnsAsync((Quiz?)null);

        var result = await _handler.Handle(new DeleteQuestionBankQuestionCommand(_userId, Guid.NewGuid()), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("QUESTION_NOT_FOUND", result.ErrorCode);
    }

    [Fact]
    public async Task Handle_QuestionOwnedByOtherUser_ReturnsFailure()
    {
        var quiz = MakeQuiz(userId: Guid.NewGuid());
        _quizzes.Setup(r => r.GetByIdAsync(quiz.QuizId, default)).ReturnsAsync(quiz);

        var result = await _handler.Handle(new DeleteQuestionBankQuestionCommand(_userId, quiz.QuizId), default);

        Assert.False(result.IsSuccess);
        _quizzes.Verify(r => r.Remove(It.IsAny<Quiz>()), Times.Never);
    }
}

// ─── UpdateQuestionBankQuestionCommand ─────────────────────────────────────────

public class UpdateQuestionBankQuestionCommandHandlerTests
{
    private readonly Mock<IUnitOfWork> _uow = new();
    private readonly Mock<IQuizRepository> _quizzes = new();
    private readonly Mock<IDocumentRepository> _documents = new();
    private readonly Mock<IVideoRepository> _videos = new();
    private readonly Mock<ICourseRepository> _courses = new();
    private readonly UpdateQuestionBankQuestionCommandHandler _handler;
    private readonly Guid _userId = Guid.NewGuid();

    public UpdateQuestionBankQuestionCommandHandlerTests()
    {
        _uow.Setup(u => u.Quizzes).Returns(_quizzes.Object);
        _uow.Setup(u => u.Documents).Returns(_documents.Object);
        _uow.Setup(u => u.Videos).Returns(_videos.Object);
        _uow.Setup(u => u.Courses).Returns(_courses.Object);
        _uow.Setup(u => u.SaveChangesAsync(default)).ReturnsAsync(1);

        _documents.Setup(r => r.FindAsync(It.IsAny<Expression<Func<Document, bool>>>(), default))
            .ReturnsAsync(Array.Empty<Document>());
        _videos.Setup(r => r.FindAsync(It.IsAny<Expression<Func<Video, bool>>>(), default))
            .ReturnsAsync(Array.Empty<Video>());
        _courses.Setup(r => r.FindAsync(It.IsAny<Expression<Func<Course, bool>>>(), default))
            .ReturnsAsync(Array.Empty<Course>());

        _handler = new UpdateQuestionBankQuestionCommandHandler(_uow.Object);
    }

    private Quiz MakeQuiz(Guid? userId = null) => new()
    {
        QuizId = Guid.NewGuid(),
        UserId = userId ?? _userId,
        Question = "Old question?",
        OptionsJson = "[\"A\",\"B\"]",
        CorrectAnswer = "A",
        Explanation = "Old explanation.",
        Difficulty = "easy",
        CreatedAt = DateTime.UtcNow,
    };

    [Fact]
    public async Task Handle_OwnedQuestion_UpdatesAndReturnsDto()
    {
        var quiz = MakeQuiz();
        _quizzes.Setup(r => r.GetByIdAsync(quiz.QuizId, default)).ReturnsAsync(quiz);

        var result = await _handler.Handle(new UpdateQuestionBankQuestionCommand(
            _userId, quiz.QuizId, "New question?", ["Option A", "Option B"], "A", "New explanation.", "hard"), default);

        Assert.True(result.IsSuccess);
        Assert.Equal("New question?", result.Data!.Question);
        Assert.Equal("hard", result.Data.Difficulty);
        _quizzes.Verify(r => r.Update(quiz), Times.Once);
        _uow.Verify(u => u.SaveChangesAsync(default), Times.Once);
    }

    [Fact]
    public async Task Handle_QuestionNotFound_ReturnsFailure()
    {
        _quizzes.Setup(r => r.GetByIdAsync(It.IsAny<Guid>(), default)).ReturnsAsync((Quiz?)null);

        var result = await _handler.Handle(new UpdateQuestionBankQuestionCommand(
            _userId, Guid.NewGuid(), "Q?", ["A", "B"], "A", "E.", "medium"), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("QUESTION_NOT_FOUND", result.ErrorCode);
    }

    [Fact]
    public async Task Handle_EmptyQuestion_ReturnsFailure()
    {
        var quiz = MakeQuiz();
        _quizzes.Setup(r => r.GetByIdAsync(quiz.QuizId, default)).ReturnsAsync(quiz);

        var result = await _handler.Handle(new UpdateQuestionBankQuestionCommand(
            _userId, quiz.QuizId, "  ", ["A"], "A", "E.", "medium"), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("INVALID_QUESTION", result.ErrorCode);
    }

    [Fact]
    public async Task Handle_AllBlankOptions_ReturnsFailure()
    {
        var quiz = MakeQuiz();
        _quizzes.Setup(r => r.GetByIdAsync(quiz.QuizId, default)).ReturnsAsync(quiz);

        var result = await _handler.Handle(new UpdateQuestionBankQuestionCommand(
            _userId, quiz.QuizId, "Q?", ["  ", "  "], "A", "E.", "medium"), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("INVALID_OPTIONS", result.ErrorCode);
    }

    [Fact]
    public async Task Handle_UnknownDifficulty_DefaultsToMedium()
    {
        var quiz = MakeQuiz();
        _quizzes.Setup(r => r.GetByIdAsync(quiz.QuizId, default)).ReturnsAsync(quiz);

        var result = await _handler.Handle(new UpdateQuestionBankQuestionCommand(
            _userId, quiz.QuizId, "Q?", ["A", "B"], "A", "E.", "nonsense"), default);

        Assert.True(result.IsSuccess);
        Assert.Equal("medium", result.Data!.Difficulty);
    }
}

// ─── GetQuestionBankQuery ──────────────────────────────────────────────────────

public class GetQuestionBankQueryHandlerTests
{
    private readonly Mock<IUnitOfWork> _uow = new();
    private readonly Mock<IQuizRepository> _quizzes = new();
    private readonly Mock<IDocumentRepository> _documents = new();
    private readonly Mock<IVideoRepository> _videos = new();
    private readonly Mock<ICourseRepository> _courses = new();
    private readonly GetQuestionBankQueryHandler _handler;
    private readonly Guid _userId = Guid.NewGuid();

    public GetQuestionBankQueryHandlerTests()
    {
        _uow.Setup(u => u.Quizzes).Returns(_quizzes.Object);
        _uow.Setup(u => u.Documents).Returns(_documents.Object);
        _uow.Setup(u => u.Videos).Returns(_videos.Object);
        _uow.Setup(u => u.Courses).Returns(_courses.Object);

        _documents.Setup(r => r.FindAsNoTrackingAsync(It.IsAny<Expression<Func<Document, bool>>>(), default))
            .ReturnsAsync(Array.Empty<Document>());
        _videos.Setup(r => r.FindAsNoTrackingAsync(It.IsAny<Expression<Func<Video, bool>>>(), default))
            .ReturnsAsync(Array.Empty<Video>());
        _courses.Setup(r => r.FindAsNoTrackingAsync(It.IsAny<Expression<Func<Course, bool>>>(), default))
            .ReturnsAsync(Array.Empty<Course>());

        _handler = new GetQuestionBankQueryHandler(_uow.Object);
    }

    private Quiz MakeQuiz(string difficulty = "medium", Guid? documentId = null) => new()
    {
        QuizId = Guid.NewGuid(),
        UserId = _userId,
        DocumentId = documentId,
        Question = "What is X?",
        OptionsJson = "[\"A\",\"B\",\"C\",\"D\"]",
        CorrectAnswer = "A",
        Explanation = "Because.",
        Difficulty = difficulty,
        SourceType = "document",
        CreatedAt = DateTime.UtcNow,
    };

    [Fact]
    public async Task Handle_NoFilters_ReturnsAllUserQuestions()
    {
        var quizzes = new[] { MakeQuiz(), MakeQuiz("easy") };
        _quizzes.Setup(r => r.FindAsNoTrackingAsync(It.IsAny<Expression<Func<Quiz, bool>>>(), default))
            .ReturnsAsync(quizzes);

        var result = await _handler.Handle(new GetQuestionBankQuery(_userId), default);

        Assert.True(result.IsSuccess);
        Assert.Equal(2, result.Data!.Count());
    }

    [Fact]
    public async Task Handle_EmptyResult_ReturnsEmptyList()
    {
        _quizzes.Setup(r => r.FindAsNoTrackingAsync(It.IsAny<Expression<Func<Quiz, bool>>>(), default))
            .ReturnsAsync(Array.Empty<Quiz>());

        var result = await _handler.Handle(new GetQuestionBankQuery(_userId), default);

        Assert.True(result.IsSuccess);
        Assert.Empty(result.Data!);
    }

    [Fact]
    public async Task Handle_QuizLinkedToDocument_PopulatesSourceName()
    {
        var docId = Guid.NewGuid();
        var quiz = MakeQuiz(documentId: docId);
        _quizzes.Setup(r => r.FindAsNoTrackingAsync(It.IsAny<Expression<Func<Quiz, bool>>>(), default))
            .ReturnsAsync(new[] { quiz });
        _documents.Setup(r => r.FindAsNoTrackingAsync(It.IsAny<Expression<Func<Document, bool>>>(), default))
            .ReturnsAsync(new[] { new Document { DocumentId = docId, UserId = _userId, FileName = "lecture.pdf", CourseId = Guid.Empty, BlobUrl = "", ContentType = "", CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow } });

        var result = await _handler.Handle(new GetQuestionBankQuery(_userId), default);

        Assert.True(result.IsSuccess);
        Assert.Equal("lecture.pdf", result.Data!.First().SourceName);
    }
}

// ─── RecordQuestionBankAttemptCommand ──────────────────────────────────────────

public class RecordQuestionBankAttemptCommandHandlerTests
{
    private readonly Mock<IUnitOfWork> _uow = new();
    private readonly Mock<IQuizRepository> _quizzes = new();
    private readonly Mock<IMistakeEntryRepository> _mistakes = new();
    private readonly RecordQuestionBankAttemptCommandHandler _handler;
    private readonly Guid _userId = Guid.NewGuid();
    private readonly List<MistakeEntry> _store = new();

    public RecordQuestionBankAttemptCommandHandlerTests()
    {
        _uow.Setup(u => u.Quizzes).Returns(_quizzes.Object);
        _uow.Setup(u => u.MistakeEntries).Returns(_mistakes.Object);
        _uow.Setup(u => u.SaveChangesAsync(default)).ReturnsAsync(1);
        _mistakes.Setup(r => r.FindAsync(It.IsAny<Expression<Func<MistakeEntry, bool>>>(), default))
            .ReturnsAsync(() => _store.ToList());
        _mistakes.Setup(r => r.AddAsync(It.IsAny<MistakeEntry>(), default))
            .Callback<MistakeEntry, CancellationToken>((e, _) => _store.Add(e))
            .Returns(Task.CompletedTask);
        _handler = new RecordQuestionBankAttemptCommandHandler(_uow.Object);
    }

    private Quiz MakeQuiz(Guid? userId = null) => new()
    {
        QuizId = Guid.NewGuid(),
        UserId = userId ?? _userId,
        Question = "What is X?",
        OptionsJson = "[\"A) one\",\"B) two\"]",
        CorrectAnswer = "A",
        Explanation = "Because.",
        Difficulty = "medium",
        CreatedAt = DateTime.UtcNow,
    };

    [Fact]
    public async Task Handle_WrongAnswer_AddsOpenMistakeEntry()
    {
        var quiz = MakeQuiz();
        _quizzes.Setup(r => r.GetByIdAsync(quiz.QuizId, default)).ReturnsAsync(quiz);

        var result = await _handler.Handle(new RecordQuestionBankAttemptCommand(_userId, quiz.QuizId, "B) two"), default);

        Assert.True(result.IsSuccess);
        Assert.False(result.Data!.IsCorrect);
        var entry = Assert.Single(_store);
        Assert.Equal(quiz.QuizId, entry.QuizId);
        Assert.Equal("open", entry.Status);
        Assert.Equal("B) two", entry.UserAnswer);
        _uow.Verify(u => u.SaveChangesAsync(default), Times.Once);
    }

    [Fact]
    public async Task Handle_CorrectAnswer_ResolvesOpenEntryWithoutAddingOne()
    {
        var quiz = MakeQuiz();
        _quizzes.Setup(r => r.GetByIdAsync(quiz.QuizId, default)).ReturnsAsync(quiz);
        var existing = new MistakeEntry
        {
            MistakeEntryId = Guid.NewGuid(),
            UserId = _userId,
            QuizId = quiz.QuizId,
            Status = "open",
            TimesMissed = 1,
        };
        _store.Add(existing);

        var result = await _handler.Handle(new RecordQuestionBankAttemptCommand(_userId, quiz.QuizId, "A) one"), default);

        Assert.True(result.IsSuccess);
        Assert.True(result.Data!.IsCorrect);
        Assert.Equal("resolved", existing.Status);
        Assert.NotNull(existing.ResolvedAt);
        Assert.Single(_store);
        _mistakes.Verify(r => r.AddAsync(It.IsAny<MistakeEntry>(), default), Times.Never);
    }

    [Fact]
    public async Task Handle_RepeatWrongAnswer_BumpsExistingEntry()
    {
        var quiz = MakeQuiz();
        _quizzes.Setup(r => r.GetByIdAsync(quiz.QuizId, default)).ReturnsAsync(quiz);
        var existing = new MistakeEntry
        {
            MistakeEntryId = Guid.NewGuid(),
            UserId = _userId,
            QuizId = quiz.QuizId,
            Status = "resolved",
            ResolvedAt = DateTime.UtcNow,
            TimesMissed = 1,
        };
        _store.Add(existing);

        var result = await _handler.Handle(new RecordQuestionBankAttemptCommand(_userId, quiz.QuizId, "B) two"), default);

        Assert.True(result.IsSuccess);
        Assert.Equal(2, existing.TimesMissed);
        Assert.Equal("open", existing.Status);
        Assert.Null(existing.ResolvedAt);
        Assert.Single(_store);
    }

    [Fact]
    public async Task Handle_QuestionNotOwned_ReturnsNotFound()
    {
        var quiz = MakeQuiz(Guid.NewGuid());
        _quizzes.Setup(r => r.GetByIdAsync(quiz.QuizId, default)).ReturnsAsync(quiz);

        var result = await _handler.Handle(new RecordQuestionBankAttemptCommand(_userId, quiz.QuizId, "A"), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("QUESTION_NOT_FOUND", result.ErrorCode);
        Assert.Empty(_store);
    }

    [Fact]
    public async Task Handle_BlankAnswer_ReturnsInvalid()
    {
        var result = await _handler.Handle(new RecordQuestionBankAttemptCommand(_userId, Guid.NewGuid(), "  "), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("INVALID_ANSWER", result.ErrorCode);
    }
}
