using System.Linq.Expressions;
using Moq;
using StudyPlatform.Application.Documents.Commands;
using StudyPlatform.Application.Services;
using StudyPlatform.Domain.Entities;
using StudyPlatform.Domain.Interfaces;
using Xunit;

namespace StudyPlatform.Tests.Documents;

// ─── DeleteDocumentCommand ─────────────────────────────────────────────────────

public class DeleteDocumentCommandHandlerTests
{
    private readonly Mock<IUnitOfWork> _uow = new();
    private readonly Mock<IDocumentRepository> _documents = new();
    private readonly Mock<IBlobStorageService> _storage = new();
    private readonly DeleteDocumentCommandHandler _handler;
    private readonly Guid _userId = Guid.NewGuid();

    public DeleteDocumentCommandHandlerTests()
    {
        _uow.Setup(u => u.Documents).Returns(_documents.Object);
        _uow.Setup(u => u.SaveChangesAsync(default)).ReturnsAsync(1);
        _handler = new DeleteDocumentCommandHandler(_uow.Object, _storage.Object);
    }

    private Document MakeDocument(Guid? userId = null) => new()
    {
        DocumentId = Guid.NewGuid(),
        UserId = userId ?? _userId,
        CourseId = Guid.NewGuid(),
        FileName = "test.pdf",
        BlobUrl = "blob://test",
        ContentType = "application/pdf",
        CreatedAt = DateTime.UtcNow,
        UpdatedAt = DateTime.UtcNow,
    };

    [Fact]
    public async Task Handle_OwnedDocument_DeletesAndReturnsSuccess()
    {
        var doc = MakeDocument();
        _documents.Setup(r => r.GetByIdAsync(doc.DocumentId, default)).ReturnsAsync(doc);
        _storage.Setup(s => s.DeleteAsync(doc.BlobUrl, default)).Returns(Task.CompletedTask);

        var result = await _handler.Handle(new DeleteDocumentCommand(doc.DocumentId, _userId), default);

        Assert.True(result.IsSuccess);
        _documents.Verify(r => r.Remove(doc), Times.Once);
        _uow.Verify(u => u.SaveChangesAsync(default), Times.Once);
    }

    [Fact]
    public async Task Handle_DocumentNotFound_ReturnsFailure()
    {
        _documents.Setup(r => r.GetByIdAsync(It.IsAny<Guid>(), default)).ReturnsAsync((Document?)null);

        var result = await _handler.Handle(new DeleteDocumentCommand(Guid.NewGuid(), _userId), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("DOCUMENT_NOT_FOUND", result.ErrorCode);
    }

    [Fact]
    public async Task Handle_DocumentOwnedByOtherUser_ReturnsFailure()
    {
        var doc = MakeDocument(userId: Guid.NewGuid());
        _documents.Setup(r => r.GetByIdAsync(doc.DocumentId, default)).ReturnsAsync(doc);

        var result = await _handler.Handle(new DeleteDocumentCommand(doc.DocumentId, _userId), default);

        Assert.False(result.IsSuccess);
        _documents.Verify(r => r.Remove(It.IsAny<Document>()), Times.Never);
    }

    [Fact]
    public async Task Handle_BlobDeletionFails_StillDeletesDocument()
    {
        var doc = MakeDocument();
        _documents.Setup(r => r.GetByIdAsync(doc.DocumentId, default)).ReturnsAsync(doc);
        _storage.Setup(s => s.DeleteAsync(doc.BlobUrl, default)).ThrowsAsync(new Exception("blob error"));

        var result = await _handler.Handle(new DeleteDocumentCommand(doc.DocumentId, _userId), default);

        Assert.True(result.IsSuccess);
        _documents.Verify(r => r.Remove(doc), Times.Once);
    }
}

// ─── UpdateDocumentCommand ─────────────────────────────────────────────────────

public class UpdateDocumentCommandHandlerTests
{
    private readonly Mock<IUnitOfWork> _uow = new();
    private readonly Mock<IDocumentRepository> _documents = new();
    private readonly UpdateDocumentCommandHandler _handler;
    private readonly Guid _userId = Guid.NewGuid();

    public UpdateDocumentCommandHandlerTests()
    {
        _uow.Setup(u => u.Documents).Returns(_documents.Object);
        _uow.Setup(u => u.SaveChangesAsync(default)).ReturnsAsync(1);
        _handler = new UpdateDocumentCommandHandler(_uow.Object);
    }

    private Document MakeDocument(Guid? userId = null) => new()
    {
        DocumentId = Guid.NewGuid(),
        UserId = userId ?? _userId,
        CourseId = Guid.NewGuid(),
        FileName = "old.pdf",
        BlobUrl = "blob://test",
        ContentType = "application/pdf",
        CreatedAt = DateTime.UtcNow,
        UpdatedAt = DateTime.UtcNow,
    };

    [Fact]
    public async Task Handle_OwnedDocument_UpdatesFileNameAndReturnsDto()
    {
        var doc = MakeDocument();
        _documents.Setup(r => r.GetByIdAsync(doc.DocumentId, default)).ReturnsAsync(doc);

        var result = await _handler.Handle(new UpdateDocumentCommand(doc.DocumentId, _userId, "  new name.pdf  "), default);

        Assert.True(result.IsSuccess);
        Assert.Equal("new name.pdf", result.Data!.FileName);
        _uow.Verify(u => u.SaveChangesAsync(default), Times.Once);
    }

    [Fact]
    public async Task Handle_DocumentNotFound_ReturnsFailure()
    {
        _documents.Setup(r => r.GetByIdAsync(It.IsAny<Guid>(), default)).ReturnsAsync((Document?)null);

        var result = await _handler.Handle(new UpdateDocumentCommand(Guid.NewGuid(), _userId, "name.pdf"), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("DOCUMENT_NOT_FOUND", result.ErrorCode);
    }

    [Fact]
    public async Task Handle_DocumentOwnedByOtherUser_ReturnsFailure()
    {
        var doc = MakeDocument(userId: Guid.NewGuid());
        _documents.Setup(r => r.GetByIdAsync(doc.DocumentId, default)).ReturnsAsync(doc);

        var result = await _handler.Handle(new UpdateDocumentCommand(doc.DocumentId, _userId, "name.pdf"), default);

        Assert.False(result.IsSuccess);
    }

    [Fact]
    public async Task Handle_EmptyFileName_ReturnsFailure()
    {
        var doc = MakeDocument();
        _documents.Setup(r => r.GetByIdAsync(doc.DocumentId, default)).ReturnsAsync(doc);

        var result = await _handler.Handle(new UpdateDocumentCommand(doc.DocumentId, _userId, "   "), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("INVALID_FILE_NAME", result.ErrorCode);
    }

    [Fact]
    public async Task Handle_FileNameOver500Chars_ReturnsFailure()
    {
        var doc = MakeDocument();
        _documents.Setup(r => r.GetByIdAsync(doc.DocumentId, default)).ReturnsAsync(doc);
        var longName = new string('a', 501);

        var result = await _handler.Handle(new UpdateDocumentCommand(doc.DocumentId, _userId, longName), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("INVALID_FILE_NAME", result.ErrorCode);
    }
}

// ─── MoveDocumentCommand ───────────────────────────────────────────────────────

public class MoveDocumentCommandHandlerTests
{
    private readonly Mock<IUnitOfWork> _uow = new();
    private readonly Mock<IDocumentRepository> _documents = new();
    private readonly Mock<ICourseRepository> _courses = new();
    private readonly MoveDocumentCommandHandler _handler;
    private readonly Guid _userId = Guid.NewGuid();

    public MoveDocumentCommandHandlerTests()
    {
        _uow.Setup(u => u.Documents).Returns(_documents.Object);
        _uow.Setup(u => u.Courses).Returns(_courses.Object);
        _uow.Setup(u => u.SaveChangesAsync(default)).ReturnsAsync(1);
        _handler = new MoveDocumentCommandHandler(_uow.Object);
    }

    private Document MakeDocument(Guid? userId = null) => new()
    {
        DocumentId = Guid.NewGuid(),
        UserId = userId ?? _userId,
        CourseId = Guid.NewGuid(),
        FileName = "test.pdf",
        BlobUrl = "blob://test",
        ContentType = "application/pdf",
        CreatedAt = DateTime.UtcNow,
        UpdatedAt = DateTime.UtcNow,
    };

    [Fact]
    public async Task Handle_OwnedDocument_MovesToTargetCourse()
    {
        var doc = MakeDocument();
        var targetCourseId = Guid.NewGuid();
        _documents.Setup(r => r.GetByIdAsync(doc.DocumentId, default)).ReturnsAsync(doc);
        _courses.Setup(r => r.BelongsToUserAsync(targetCourseId, _userId, default)).ReturnsAsync(true);

        var result = await _handler.Handle(new MoveDocumentCommand(doc.DocumentId, _userId, targetCourseId), default);

        Assert.True(result.IsSuccess);
        Assert.Equal(targetCourseId, result.Data!.CourseId);
    }

    [Fact]
    public async Task Handle_DocumentNotFound_ReturnsFailure()
    {
        _documents.Setup(r => r.GetByIdAsync(It.IsAny<Guid>(), default)).ReturnsAsync((Document?)null);

        var result = await _handler.Handle(new MoveDocumentCommand(Guid.NewGuid(), _userId, Guid.NewGuid()), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("DOCUMENT_NOT_FOUND", result.ErrorCode);
    }

    [Fact]
    public async Task Handle_TargetCourseNotFound_ReturnsFailure()
    {
        var doc = MakeDocument();
        var targetCourseId = Guid.NewGuid();
        _documents.Setup(r => r.GetByIdAsync(doc.DocumentId, default)).ReturnsAsync(doc);
        _courses.Setup(r => r.BelongsToUserAsync(targetCourseId, _userId, default)).ReturnsAsync(false);

        var result = await _handler.Handle(new MoveDocumentCommand(doc.DocumentId, _userId, targetCourseId), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("COURSE_NOT_FOUND", result.ErrorCode);
    }
}

// ─── SaveQuizSubmissionCommand ─────────────────────────────────────────────────

public class SaveQuizSubmissionCommandHandlerTests
{
    private readonly Mock<IUnitOfWork> _uow = new();
    private readonly Mock<IDocumentRepository> _documents = new();
    private readonly Mock<IQuizSubmissionRepository> _submissions = new();
    private readonly Mock<IQuizRepository> _quizzes = new();
    private readonly Mock<IMistakeEntryRepository> _mistakes = new();
    private readonly SaveQuizSubmissionCommandHandler _handler;
    private readonly Guid _userId = Guid.NewGuid();

    public SaveQuizSubmissionCommandHandlerTests()
    {
        _uow.Setup(u => u.Documents).Returns(_documents.Object);
        _uow.Setup(u => u.QuizSubmissions).Returns(_submissions.Object);
        _uow.Setup(u => u.Quizzes).Returns(_quizzes.Object);
        _uow.Setup(u => u.MistakeEntries).Returns(_mistakes.Object);
        _quizzes.Setup(r => r.FindAsync(It.IsAny<System.Linq.Expressions.Expression<Func<Quiz, bool>>>(), default))
            .ReturnsAsync(Array.Empty<Quiz>());
        _mistakes.Setup(r => r.FindAsync(It.IsAny<System.Linq.Expressions.Expression<Func<MistakeEntry, bool>>>(), default))
            .ReturnsAsync(Array.Empty<MistakeEntry>());
        _uow.Setup(u => u.SaveChangesAsync(default)).ReturnsAsync(1);
        _handler = new SaveQuizSubmissionCommandHandler(_uow.Object);
    }

    private Document MakeDocument(Guid? userId = null) => new()
    {
        DocumentId = Guid.NewGuid(),
        UserId = userId ?? _userId,
        CourseId = Guid.NewGuid(),
        FileName = "test.pdf",
        BlobUrl = "blob://test",
        ContentType = "application/pdf",
        CreatedAt = DateTime.UtcNow,
        UpdatedAt = DateTime.UtcNow,
    };

    [Fact]
    public async Task Handle_NewSubmission_CreatesAndReturnsDto()
    {
        var doc = MakeDocument();
        var answers = new Dictionary<string, string> { ["q1"] = "A", ["q2"] = "B" };
        _documents.Setup(r => r.GetByIdAsync(doc.DocumentId, default)).ReturnsAsync(doc);
        _submissions.Setup(r => r.GetByDocumentAndUserAsync(doc.DocumentId, _userId, default))
            .ReturnsAsync((QuizSubmission?)null);
        _submissions.Setup(r => r.AddAsync(It.IsAny<QuizSubmission>(), default)).Returns(Task.CompletedTask);

        var result = await _handler.Handle(
            new SaveQuizSubmissionCommand(doc.DocumentId, _userId, answers, 8, 10), default);

        Assert.True(result.IsSuccess);
        Assert.Equal(8, result.Data!.Score);
        Assert.Equal(10, result.Data.Total);
        Assert.Equal(answers, result.Data.Answers);
        _submissions.Verify(r => r.AddAsync(It.IsAny<QuizSubmission>(), default), Times.Once);
    }

    [Fact]
    public async Task Handle_ExistingSubmission_UpdatesAndReturnsDto()
    {
        var doc = MakeDocument();
        var existing = new QuizSubmission
        {
            SubmissionId = Guid.NewGuid(),
            DocumentId = doc.DocumentId,
            UserId = _userId,
            AnswersJson = "{}",
            Score = 5,
            Total = 10,
            SubmittedAt = DateTime.UtcNow.AddDays(-1),
        };
        _documents.Setup(r => r.GetByIdAsync(doc.DocumentId, default)).ReturnsAsync(doc);
        _submissions.Setup(r => r.GetByDocumentAndUserAsync(doc.DocumentId, _userId, default))
            .ReturnsAsync(existing);

        var newAnswers = new Dictionary<string, string> { ["q1"] = "C" };
        var result = await _handler.Handle(
            new SaveQuizSubmissionCommand(doc.DocumentId, _userId, newAnswers, 9, 10), default);

        Assert.True(result.IsSuccess);
        Assert.Equal(9, result.Data!.Score);
        _submissions.Verify(r => r.AddAsync(It.IsAny<QuizSubmission>(), default), Times.Never);
        _submissions.Verify(r => r.Update(existing), Times.Once);
    }

    [Fact]
    public async Task Handle_DocumentNotFound_ReturnsFailure()
    {
        _documents.Setup(r => r.GetByIdAsync(It.IsAny<Guid>(), default)).ReturnsAsync((Document?)null);

        var result = await _handler.Handle(
            new SaveQuizSubmissionCommand(Guid.NewGuid(), _userId, new Dictionary<string, string>(), 0, 0), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("DOCUMENT_NOT_FOUND", result.ErrorCode);
    }

    [Fact]
    public async Task Handle_DocumentOwnedByOtherUser_ReturnsFailure()
    {
        var doc = MakeDocument(userId: Guid.NewGuid());
        _documents.Setup(r => r.GetByIdAsync(doc.DocumentId, default)).ReturnsAsync(doc);

        var result = await _handler.Handle(
            new SaveQuizSubmissionCommand(doc.DocumentId, _userId, new Dictionary<string, string>(), 0, 0), default);

        Assert.False(result.IsSuccess);
    }
}
