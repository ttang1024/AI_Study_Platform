using System.Linq.Expressions;
using MediatR;
using Moq;
using StudyPlatform.Application.Documents.Commands;
using StudyPlatform.Domain.Entities;
using StudyPlatform.Domain.Interfaces;
using Xunit;

namespace StudyPlatform.Tests.Documents;

public class GetDocumentStalenessQueryHandlerTests
{
    private readonly Mock<IUnitOfWork> _uow = new();
    private readonly Mock<IDocumentRepository> _documents = new();
    private readonly Mock<IFlashcardRepository> _flashcards = new();
    private readonly Mock<IQuizRepository> _quizzes = new();
    private readonly Mock<IGlossaryTermRepository> _glossary = new();

    private readonly Guid _userId = Guid.NewGuid();
    private readonly Guid _documentId = Guid.NewGuid();
    private readonly GetDocumentStalenessQueryHandler _handler;

    public GetDocumentStalenessQueryHandlerTests()
    {
        _uow.Setup(u => u.Documents).Returns(_documents.Object);
        _uow.Setup(u => u.Flashcards).Returns(_flashcards.Object);
        _uow.Setup(u => u.Quizzes).Returns(_quizzes.Object);
        _uow.Setup(u => u.GlossaryTerms).Returns(_glossary.Object);

        _flashcards.Setup(r => r.CountAsync(It.IsAny<Expression<Func<Flashcard, bool>>>(), default)).ReturnsAsync(0);
        _quizzes.Setup(r => r.CountAsync(It.IsAny<Expression<Func<Quiz, bool>>>(), default)).ReturnsAsync(0);
        _glossary.Setup(r => r.CountAsync(It.IsAny<Expression<Func<GlossaryTerm, bool>>>(), default)).ReturnsAsync(0);

        _handler = new GetDocumentStalenessQueryHandler(_uow.Object);
    }

    private void DocumentIs(Document document) =>
        _documents.Setup(r => r.GetByIdAsync(_documentId, default)).ReturnsAsync(document);

    private Document Doc(
        int version = 1,
        DateTime? changedAt = null,
        string? summary = null,
        string? mindMap = null,
        int? summaryVersion = null,
        int? mindMapVersion = null) => new()
    {
        DocumentId = _documentId,
        UserId = _userId,
        ContentVersion = version,
        SourceChangedAt = changedAt,
        Summary = summary,
        MindMapText = mindMap,
        SummaryVersion = summaryVersion ?? 1,
        MindMapVersion = mindMapVersion ?? 1,
    };

    [Fact]
    public async Task AnotherUsersDocument_IsNotFound()
    {
        DocumentIs(new Document { DocumentId = _documentId, UserId = Guid.NewGuid() });

        var result = await _handler.Handle(new GetDocumentStalenessQuery(_userId, _documentId), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("DOCUMENT_NOT_FOUND", result.ErrorCode);
    }

    [Fact]
    public async Task NeverReplaced_NothingIsStale()
    {
        DocumentIs(Doc(version: 1, summary: "a summary", mindMap: "a map"));

        var result = await _handler.Handle(new GetDocumentStalenessQuery(_userId, _documentId), default);

        Assert.True(result.IsSuccess);
        Assert.False(result.Data!.HasStaleArtifacts);
        Assert.False(result.Data.SummaryStale);
        Assert.False(result.Data.MindMapStale);
    }

    [Fact]
    public async Task AfterReplacement_CountsArtifactsBelowTheCurrentVersion()
    {
        DocumentIs(Doc(version: 2, changedAt: DateTime.UtcNow));
        _flashcards.Setup(r => r.CountAsync(It.IsAny<Expression<Func<Flashcard, bool>>>(), default)).ReturnsAsync(12);
        _quizzes.Setup(r => r.CountAsync(It.IsAny<Expression<Func<Quiz, bool>>>(), default)).ReturnsAsync(5);
        _glossary.Setup(r => r.CountAsync(It.IsAny<Expression<Func<GlossaryTerm, bool>>>(), default)).ReturnsAsync(9);

        var result = await _handler.Handle(new GetDocumentStalenessQuery(_userId, _documentId), default);

        Assert.Equal(12, result.Data!.StaleFlashcards);
        Assert.Equal(5, result.Data.StaleQuizzes);
        Assert.Equal(9, result.Data.StaleGlossaryTerms);
        Assert.True(result.Data.HasStaleArtifacts);
    }

    [Fact]
    public async Task SummaryIsOnlyStaleWhenOneExists()
    {
        // A document with no summary must not report a stale summary; there is nothing to rebuild.
        DocumentIs(Doc(version: 2, changedAt: DateTime.UtcNow, summary: null, mindMap: "a map"));

        var result = await _handler.Handle(new GetDocumentStalenessQuery(_userId, _documentId), default);

        Assert.False(result.Data!.SummaryStale);
        Assert.True(result.Data.MindMapStale);
    }

    [Fact]
    public async Task RegeneratedSummary_StopsBeingStale()
    {
        // The banner is only dismissible if acting on it can clear the flag. Keying staleness off
        // SourceChangedAt made this permanently true, so a document re-uploaded once warned about
        // its summary forever, no matter how many times the reader rebuilt it.
        DocumentIs(Doc(
            version: 2, changedAt: DateTime.UtcNow,
            summary: "regenerated against the new file", summaryVersion: 2,
            mindMap: "still from the old file", mindMapVersion: 1));

        var result = await _handler.Handle(new GetDocumentStalenessQuery(_userId, _documentId), default);

        Assert.False(result.Data!.SummaryStale);
        Assert.True(result.Data.MindMapStale);
    }

    [Fact]
    public async Task NothingStaleAtAll_ReportsNoStaleArtifacts()
    {
        // Everything rebuilt after the replacement: the banner must disappear entirely.
        DocumentIs(Doc(
            version: 3, changedAt: DateTime.UtcNow,
            summary: "current", summaryVersion: 3,
            mindMap: "current", mindMapVersion: 3));

        var result = await _handler.Handle(new GetDocumentStalenessQuery(_userId, _documentId), default);

        Assert.False(result.Data!.HasStaleArtifacts);
    }

    [Fact]
    public async Task StalenessPredicateComparesAgainstTheCurrentVersion()
    {
        // Guards the actual predicate: an artifact at the current version is current, one below is
        // stale. Getting this boundary wrong would either never regenerate or always regenerate.
        DocumentIs(Doc(version: 3, changedAt: DateTime.UtcNow));

        Expression<Func<Flashcard, bool>>? captured = null;
        _flashcards
            .Setup(r => r.CountAsync(It.IsAny<Expression<Func<Flashcard, bool>>>(), default))
            .Callback<Expression<Func<Flashcard, bool>>, CancellationToken>((e, _) => captured = e)
            .ReturnsAsync(0);

        await _handler.Handle(new GetDocumentStalenessQuery(_userId, _documentId), default);

        Assert.NotNull(captured);
        var predicate = captured!.Compile();

        Assert.True(predicate(new Flashcard { DocumentId = _documentId, SourceVersion = 2 }));
        Assert.False(predicate(new Flashcard { DocumentId = _documentId, SourceVersion = 3 }));
        Assert.False(predicate(new Flashcard { DocumentId = Guid.NewGuid(), SourceVersion = 1 }));
    }
}

public class RegenerateStaleArtifactsCommandHandlerTests
{
    private readonly Mock<IUnitOfWork> _uow = new();
    private readonly Mock<IDocumentRepository> _documents = new();
    private readonly Mock<IFlashcardRepository> _flashcards = new();
    private readonly Mock<IQuizRepository> _quizzes = new();
    private readonly Mock<IGlossaryTermRepository> _glossary = new();
    private readonly Mock<IMediator> _mediator = new();

    private readonly Guid _userId = Guid.NewGuid();
    private readonly Guid _documentId = Guid.NewGuid();
    private readonly RegenerateStaleArtifactsCommandHandler _handler;

    public RegenerateStaleArtifactsCommandHandlerTests()
    {
        _uow.Setup(u => u.Documents).Returns(_documents.Object);
        _uow.Setup(u => u.Flashcards).Returns(_flashcards.Object);
        _uow.Setup(u => u.Quizzes).Returns(_quizzes.Object);
        _uow.Setup(u => u.GlossaryTerms).Returns(_glossary.Object);
        _uow.Setup(u => u.SaveChangesAsync(default)).ReturnsAsync(1);

        _documents.Setup(r => r.GetByIdAsync(_documentId, default))
            .ReturnsAsync(new Document { DocumentId = _documentId, UserId = _userId, ContentVersion = 2 });

        _flashcards.Setup(r => r.FindAsync(It.IsAny<Expression<Func<Flashcard, bool>>>(), default))
            .ReturnsAsync(new List<Flashcard> { new() });
        _quizzes.Setup(r => r.FindAsync(It.IsAny<Expression<Func<Quiz, bool>>>(), default))
            .ReturnsAsync(new List<Quiz> { new() });
        _glossary.Setup(r => r.FindAsync(It.IsAny<Expression<Func<GlossaryTerm, bool>>>(), default))
            .ReturnsAsync(new List<GlossaryTerm> { new() });

        _handler = new RegenerateStaleArtifactsCommandHandler(_uow.Object, _mediator.Object);
    }

    [Fact]
    public async Task OnlyClearsTheRequestedKinds()
    {
        await _handler.Handle(
            new RegenerateStaleArtifactsCommand(_userId, _documentId, Flashcards: true, Quizzes: false, Glossary: false),
            default);

        _flashcards.Verify(r => r.RemoveRange(It.IsAny<IEnumerable<Flashcard>>()), Times.Once);
        _quizzes.Verify(r => r.RemoveRange(It.IsAny<IEnumerable<Quiz>>()), Times.Never);
        _glossary.Verify(r => r.RemoveRange(It.IsAny<IEnumerable<GlossaryTerm>>()), Times.Never);
    }

    [Fact]
    public async Task AnotherUsersDocument_ClearsNothing()
    {
        _documents.Setup(r => r.GetByIdAsync(_documentId, default))
            .ReturnsAsync(new Document { DocumentId = _documentId, UserId = Guid.NewGuid(), ContentVersion = 2 });

        var result = await _handler.Handle(
            new RegenerateStaleArtifactsCommand(_userId, _documentId, true, true, true), default);

        Assert.False(result.IsSuccess);
        _flashcards.Verify(r => r.RemoveRange(It.IsAny<IEnumerable<Flashcard>>()), Times.Never);
        _uow.Verify(u => u.SaveChangesAsync(default), Times.Never);
    }
}
