using Moq;
using StudyPlatform.Application.Documents.Queries;
using StudyPlatform.Domain.Entities;
using StudyPlatform.Domain.Interfaces;
using Xunit;

namespace StudyPlatform.Tests.Documents;

// ─── GetAllDocumentsQuery ──────────────────────────────────────────────────────

public class GetAllDocumentsQueryHandlerTests
{
    private readonly Mock<IUnitOfWork> _uow = new();
    private readonly Mock<IDocumentRepository> _documents = new();
    private readonly GetAllDocumentsQueryHandler _handler;
    private readonly Guid _userId = Guid.NewGuid();

    public GetAllDocumentsQueryHandlerTests()
    {
        _uow.Setup(u => u.Documents).Returns(_documents.Object);
        _handler = new GetAllDocumentsQueryHandler(_uow.Object);
    }

    private Document MakeDocument() => new()
    {
        DocumentId = Guid.NewGuid(),
        UserId = _userId,
        CourseId = Guid.NewGuid(),
        FileName = "file.pdf",
        BlobUrl = "blob://x",
        ContentType = "application/pdf",
        CreatedAt = DateTime.UtcNow,
        UpdatedAt = DateTime.UtcNow,
    };

    [Fact]
    public async Task Handle_ReturnsMappedPagedResult()
    {
        var docs = new[] { MakeDocument(), MakeDocument() };
        _documents.Setup(r => r.GetAllByUserIdAsync(_userId, 1, 20, null, default))
            .ReturnsAsync((docs, 2));

        var result = await _handler.Handle(new GetAllDocumentsQuery(_userId, 1, 20, null), default);

        Assert.True(result.IsSuccess);
        Assert.Equal(2, result.Data!.TotalCount);
        Assert.Equal(2, result.Data.Items.Count());
    }

    [Fact]
    public async Task Handle_NoDocuments_ReturnsEmptyPage()
    {
        _documents.Setup(r => r.GetAllByUserIdAsync(_userId, 1, 20, null, default))
            .ReturnsAsync((Array.Empty<Document>(), 0));

        var result = await _handler.Handle(new GetAllDocumentsQuery(_userId, 1, 20, null), default);

        Assert.True(result.IsSuccess);
        Assert.Equal(0, result.Data!.TotalCount);
        Assert.Empty(result.Data.Items);
    }

    [Fact]
    public async Task Handle_CourseIdFilter_PassedToRepository()
    {
        var courseId = Guid.NewGuid();
        _documents.Setup(r => r.GetAllByUserIdAsync(_userId, 1, 10, courseId, default))
            .ReturnsAsync((Array.Empty<Document>(), 0));

        var result = await _handler.Handle(new GetAllDocumentsQuery(_userId, 1, 10, courseId), default);

        Assert.True(result.IsSuccess);
        _documents.Verify(r => r.GetAllByUserIdAsync(_userId, 1, 10, courseId, default), Times.Once);
    }
}

// ─── GetDocumentByIdQuery ──────────────────────────────────────────────────────

public class GetDocumentByIdQueryHandlerTests
{
    private readonly Mock<IUnitOfWork> _uow = new();
    private readonly Mock<IDocumentRepository> _documents = new();
    private readonly GetDocumentByIdQueryHandler _handler;
    private readonly Guid _userId = Guid.NewGuid();

    public GetDocumentByIdQueryHandlerTests()
    {
        _uow.Setup(u => u.Documents).Returns(_documents.Object);
        _handler = new GetDocumentByIdQueryHandler(_uow.Object);
    }

    private Document MakeDocument(Guid? userId = null) => new()
    {
        DocumentId = Guid.NewGuid(),
        UserId = userId ?? _userId,
        CourseId = Guid.NewGuid(),
        FileName = "file.pdf",
        BlobUrl = "blob://x",
        ContentType = "application/pdf",
        CreatedAt = DateTime.UtcNow,
        UpdatedAt = DateTime.UtcNow,
    };

    [Fact]
    public async Task Handle_OwnedDocument_ReturnsMappedDto()
    {
        var doc = MakeDocument();
        _documents.Setup(r => r.GetByIdAsync(doc.DocumentId, default)).ReturnsAsync(doc);

        var result = await _handler.Handle(new GetDocumentByIdQuery(doc.DocumentId, _userId), default);

        Assert.True(result.IsSuccess);
        Assert.Equal(doc.DocumentId, result.Data!.DocumentId);
        Assert.Equal(doc.FileName, result.Data.FileName);
    }

    [Fact]
    public async Task Handle_DocumentNotFound_ReturnsFailure()
    {
        _documents.Setup(r => r.GetByIdAsync(It.IsAny<Guid>(), default)).ReturnsAsync((Document?)null);

        var result = await _handler.Handle(new GetDocumentByIdQuery(Guid.NewGuid(), _userId), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("DOCUMENT_NOT_FOUND", result.ErrorCode);
    }
}

// ─── GetDocumentQuizzesQuery ───────────────────────────────────────────────────

public class GetDocumentQuizzesQueryHandlerTests
{
    private readonly Mock<IUnitOfWork> _uow = new();
    private readonly Mock<IDocumentRepository> _documents = new();
    private readonly Mock<IQuizRepository> _quizzes = new();
    private readonly GetDocumentQuizzesQueryHandler _handler;
    private readonly Guid _userId = Guid.NewGuid();

    public GetDocumentQuizzesQueryHandlerTests()
    {
        _uow.Setup(u => u.Documents).Returns(_documents.Object);
        _uow.Setup(u => u.Quizzes).Returns(_quizzes.Object);
        _handler = new GetDocumentQuizzesQueryHandler(_uow.Object);
    }

    private Document MakeDocument(Guid? userId = null) => new()
    {
        DocumentId = Guid.NewGuid(),
        UserId = userId ?? _userId,
        CourseId = Guid.NewGuid(),
        FileName = "file.pdf",
        BlobUrl = "blob://x",
        ContentType = "application/pdf",
        CreatedAt = DateTime.UtcNow,
        UpdatedAt = DateTime.UtcNow,
    };

    private Quiz MakeQuiz(Guid documentId, string difficulty = "medium") => new()
    {
        QuizId = Guid.NewGuid(),
        DocumentId = documentId,
        UserId = _userId,
        Question = "What is X?",
        OptionsJson = "[\"A\",\"B\",\"C\",\"D\"]",
        CorrectAnswer = "A",
        Explanation = "Because X.",
        Difficulty = difficulty,
        CreatedAt = DateTime.UtcNow,
    };

    [Fact]
    public async Task Handle_ReturnsAllQuizzesForDocument()
    {
        var doc = MakeDocument();
        var quizzes = new[] { MakeQuiz(doc.DocumentId), MakeQuiz(doc.DocumentId) };
        _documents.Setup(r => r.GetByIdAsync(doc.DocumentId, default)).ReturnsAsync(doc);
        _quizzes.Setup(r => r.GetByDocumentIdAsync(doc.DocumentId, default)).ReturnsAsync(quizzes);

        var result = await _handler.Handle(new GetDocumentQuizzesQuery(doc.DocumentId, _userId), default);

        Assert.True(result.IsSuccess);
        Assert.Equal(2, result.Data!.Count());
    }

    [Fact]
    public async Task Handle_DifficultyFilter_UsesFilteredQuery()
    {
        var doc = MakeDocument();
        var quiz = MakeQuiz(doc.DocumentId, "easy");
        _documents.Setup(r => r.GetByIdAsync(doc.DocumentId, default)).ReturnsAsync(doc);
        _quizzes.Setup(r => r.GetByDocumentIdAndDifficultyAsync(doc.DocumentId, "easy", default))
            .ReturnsAsync(new[] { quiz });

        var result = await _handler.Handle(new GetDocumentQuizzesQuery(doc.DocumentId, _userId, "easy"), default);

        Assert.True(result.IsSuccess);
        Assert.Single(result.Data!);
        _quizzes.Verify(r => r.GetByDocumentIdAndDifficultyAsync(doc.DocumentId, "easy", default), Times.Once);
        _quizzes.Verify(r => r.GetByDocumentIdAsync(It.IsAny<Guid>(), default), Times.Never);
    }

    [Fact]
    public async Task Handle_DocumentNotFound_ReturnsFailure()
    {
        _documents.Setup(r => r.GetByIdAsync(It.IsAny<Guid>(), default)).ReturnsAsync((Document?)null);

        var result = await _handler.Handle(new GetDocumentQuizzesQuery(Guid.NewGuid(), _userId), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("DOCUMENT_NOT_FOUND", result.ErrorCode);
    }
}

// ─── GetGlossaryTermsQuery ─────────────────────────────────────────────────────

public class GetGlossaryTermsQueryHandlerTests
{
    private readonly Mock<IUnitOfWork> _uow = new();
    private readonly Mock<IDocumentRepository> _documents = new();
    private readonly Mock<IGlossaryTermRepository> _terms = new();
    private readonly GetGlossaryTermsQueryHandler _handler;
    private readonly Guid _userId = Guid.NewGuid();

    public GetGlossaryTermsQueryHandlerTests()
    {
        _uow.Setup(u => u.Documents).Returns(_documents.Object);
        _uow.Setup(u => u.GlossaryTerms).Returns(_terms.Object);
        _handler = new GetGlossaryTermsQueryHandler(_uow.Object);
    }

    private Document MakeDocument(Guid? userId = null) => new()
    {
        DocumentId = Guid.NewGuid(),
        UserId = userId ?? _userId,
        CourseId = Guid.NewGuid(),
        FileName = "file.pdf",
        BlobUrl = "blob://x",
        ContentType = "application/pdf",
        CreatedAt = DateTime.UtcNow,
        UpdatedAt = DateTime.UtcNow,
    };

    [Fact]
    public async Task Handle_ReturnsMappedTermDtos()
    {
        var doc = MakeDocument();
        var glossaryTerms = new[]
        {
            new GlossaryTerm { GlossaryTermId = Guid.NewGuid(), DocumentId = doc.DocumentId, UserId = _userId, Term = "Foo", Definition = "Bar", CreatedAt = DateTime.UtcNow },
            new GlossaryTerm { GlossaryTermId = Guid.NewGuid(), DocumentId = doc.DocumentId, UserId = _userId, Term = "Baz", Definition = "Qux", CreatedAt = DateTime.UtcNow },
        };
        _documents.Setup(r => r.GetByIdAsync(doc.DocumentId, default)).ReturnsAsync(doc);
        _terms.Setup(r => r.GetByDocumentIdAsync(doc.DocumentId, default)).ReturnsAsync(glossaryTerms);

        var result = await _handler.Handle(new GetGlossaryTermsQuery(doc.DocumentId, _userId), default);

        Assert.True(result.IsSuccess);
        Assert.Equal(2, result.Data!.Count());
    }

    [Fact]
    public async Task Handle_DocumentNotFound_ReturnsFailure()
    {
        _documents.Setup(r => r.GetByIdAsync(It.IsAny<Guid>(), default)).ReturnsAsync((Document?)null);

        var result = await _handler.Handle(new GetGlossaryTermsQuery(Guid.NewGuid(), _userId), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("DOCUMENT_NOT_FOUND", result.ErrorCode);
    }

    [Fact]
    public async Task Handle_DocumentOwnedByOtherUser_ReturnsFailure()
    {
        var doc = MakeDocument(userId: Guid.NewGuid());
        _documents.Setup(r => r.GetByIdAsync(doc.DocumentId, default)).ReturnsAsync(doc);

        var result = await _handler.Handle(new GetGlossaryTermsQuery(doc.DocumentId, _userId), default);

        Assert.False(result.IsSuccess);
    }
}
