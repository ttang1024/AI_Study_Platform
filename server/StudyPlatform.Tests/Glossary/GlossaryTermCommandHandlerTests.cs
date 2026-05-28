using Moq;
using StudyPlatform.Application.Glossary.Commands;
using StudyPlatform.Domain.Entities;
using StudyPlatform.Domain.Interfaces;
using Xunit;

namespace StudyPlatform.Tests.Glossary;

// ─── UpdateGlossaryTermCommand ─────────────────────────────────────────────────

public class UpdateGlossaryTermCommandHandlerTests
{
    private readonly Mock<IUnitOfWork> _uow = new();
    private readonly Mock<IGlossaryTermRepository> _terms = new();
    private readonly UpdateGlossaryTermCommandHandler _handler;
    private readonly Guid _userId = Guid.NewGuid();

    public UpdateGlossaryTermCommandHandlerTests()
    {
        _uow.Setup(u => u.GlossaryTerms).Returns(_terms.Object);
        _uow.Setup(u => u.SaveChangesAsync(default)).ReturnsAsync(1);
        _handler = new UpdateGlossaryTermCommandHandler(_uow.Object);
    }

    private GlossaryTerm MakeTerm(Guid? userId = null) => new()
    {
        GlossaryTermId = Guid.NewGuid(),
        UserId = userId ?? _userId,
        DocumentId = Guid.NewGuid(),
        Term = "Old Term",
        Definition = "Old Definition",
        CreatedAt = DateTime.UtcNow,
    };

    [Fact]
    public async Task Handle_OwnedTerm_UpdatesAndReturnsDto()
    {
        var term = MakeTerm();
        _terms.Setup(r => r.GetByIdAsync(term.GlossaryTermId, default)).ReturnsAsync(term);

        var result = await _handler.Handle(
            new UpdateGlossaryTermCommand(_userId, term.GlossaryTermId, "  New Term  ", "  New Definition  "), default);

        Assert.True(result.IsSuccess);
        Assert.Equal("New Term", result.Data!.Term);
        Assert.Equal("New Definition", result.Data.Definition);
        _terms.Verify(r => r.Update(term), Times.Once);
        _uow.Verify(u => u.SaveChangesAsync(default), Times.Once);
    }

    [Fact]
    public async Task Handle_TermNotFound_ReturnsFailure()
    {
        _terms.Setup(r => r.GetByIdAsync(It.IsAny<Guid>(), default)).ReturnsAsync((GlossaryTerm?)null);

        var result = await _handler.Handle(
            new UpdateGlossaryTermCommand(_userId, Guid.NewGuid(), "T", "D"), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("NOT_FOUND", result.ErrorCode);
    }

    [Fact]
    public async Task Handle_TermOwnedByOtherUser_ReturnsFailure()
    {
        var term = MakeTerm(userId: Guid.NewGuid());
        _terms.Setup(r => r.GetByIdAsync(term.GlossaryTermId, default)).ReturnsAsync(term);

        var result = await _handler.Handle(
            new UpdateGlossaryTermCommand(_userId, term.GlossaryTermId, "T", "D"), default);

        Assert.False(result.IsSuccess);
        _terms.Verify(r => r.Update(It.IsAny<GlossaryTerm>()), Times.Never);
    }
}

// ─── DeleteGlossaryTermCommand ─────────────────────────────────────────────────

public class DeleteGlossaryTermCommandHandlerTests
{
    private readonly Mock<IUnitOfWork> _uow = new();
    private readonly Mock<IGlossaryTermRepository> _terms = new();
    private readonly DeleteGlossaryTermCommandHandler _handler;
    private readonly Guid _userId = Guid.NewGuid();

    public DeleteGlossaryTermCommandHandlerTests()
    {
        _uow.Setup(u => u.GlossaryTerms).Returns(_terms.Object);
        _uow.Setup(u => u.SaveChangesAsync(default)).ReturnsAsync(1);
        _handler = new DeleteGlossaryTermCommandHandler(_uow.Object);
    }

    private GlossaryTerm MakeTerm(Guid? userId = null) => new()
    {
        GlossaryTermId = Guid.NewGuid(),
        UserId = userId ?? _userId,
        Term = "Term",
        Definition = "Def",
        CreatedAt = DateTime.UtcNow,
    };

    [Fact]
    public async Task Handle_OwnedTerm_DeletesAndReturnsTrue()
    {
        var term = MakeTerm();
        _terms.Setup(r => r.GetByIdAsync(term.GlossaryTermId, default)).ReturnsAsync(term);

        var result = await _handler.Handle(new DeleteGlossaryTermCommand(_userId, term.GlossaryTermId), default);

        Assert.True(result.IsSuccess);
        Assert.True(result.Data);
        _terms.Verify(r => r.Remove(term), Times.Once);
        _uow.Verify(u => u.SaveChangesAsync(default), Times.Once);
    }

    [Fact]
    public async Task Handle_TermNotFound_ReturnsFailure()
    {
        _terms.Setup(r => r.GetByIdAsync(It.IsAny<Guid>(), default)).ReturnsAsync((GlossaryTerm?)null);

        var result = await _handler.Handle(new DeleteGlossaryTermCommand(_userId, Guid.NewGuid()), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("NOT_FOUND", result.ErrorCode);
    }

    [Fact]
    public async Task Handle_TermOwnedByOtherUser_ReturnsFailure()
    {
        var term = MakeTerm(userId: Guid.NewGuid());
        _terms.Setup(r => r.GetByIdAsync(term.GlossaryTermId, default)).ReturnsAsync(term);

        var result = await _handler.Handle(new DeleteGlossaryTermCommand(_userId, term.GlossaryTermId), default);

        Assert.False(result.IsSuccess);
        _terms.Verify(r => r.Remove(It.IsAny<GlossaryTerm>()), Times.Never);
    }
}

// ─── GetAllGlossaryTermsQuery ──────────────────────────────────────────────────

public class GetAllGlossaryTermsQueryHandlerTests
{
    private readonly Mock<IUnitOfWork> _uow = new();
    private readonly Mock<IGlossaryTermRepository> _terms = new();
    private readonly GetAllGlossaryTermsQueryHandler _handler;
    private readonly Guid _userId = Guid.NewGuid();

    public GetAllGlossaryTermsQueryHandlerTests()
    {
        _uow.Setup(u => u.GlossaryTerms).Returns(_terms.Object);
        _handler = new GetAllGlossaryTermsQueryHandler(_uow.Object);
    }

    [Fact]
    public async Task Handle_ReturnsMappedTermDtos()
    {
        var docId = Guid.NewGuid();
        var terms = new[]
        {
            new GlossaryTerm { GlossaryTermId = Guid.NewGuid(), UserId = _userId, DocumentId = docId, Term = "Foo", Definition = "Bar", CreatedAt = DateTime.UtcNow, Document = new Document { DocumentId = docId, FileName = "doc.pdf", CourseId = Guid.NewGuid(), UserId = _userId, BlobUrl = "", ContentType = "", CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow } },
        };
        _terms.Setup(r => r.GetByUserWithSourcesAsync(_userId, default)).ReturnsAsync(terms);

        var result = await _handler.Handle(new GetAllGlossaryTermsQuery(_userId), default);

        Assert.True(result.IsSuccess);
        Assert.Single(result.Data!);
        Assert.Equal("Foo", result.Data!.First().Term);
    }

    [Fact]
    public async Task Handle_NoTerms_ReturnsEmptyList()
    {
        _terms.Setup(r => r.GetByUserWithSourcesAsync(_userId, default)).ReturnsAsync(Array.Empty<GlossaryTerm>());

        var result = await _handler.Handle(new GetAllGlossaryTermsQuery(_userId), default);

        Assert.True(result.IsSuccess);
        Assert.Empty(result.Data!);
    }

    [Fact]
    public async Task Handle_AudioDocumentTerm_SetsSourceKindToAudio()
    {
        var docId = Guid.NewGuid();
        var term = new GlossaryTerm
        {
            GlossaryTermId = Guid.NewGuid(),
            UserId = _userId,
            DocumentId = docId,
            Term = "Audio Term",
            Definition = "Def",
            CreatedAt = DateTime.UtcNow,
            Document = new Document { DocumentId = docId, FileName = "lecture.mp3", ContentType = "audio/mpeg", CourseId = Guid.NewGuid(), UserId = _userId, BlobUrl = "", CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow },
        };
        _terms.Setup(r => r.GetByUserWithSourcesAsync(_userId, default)).ReturnsAsync(new[] { term });

        var result = await _handler.Handle(new GetAllGlossaryTermsQuery(_userId), default);

        Assert.Equal("audio", result.Data!.First().SourceKind);
    }

    [Fact]
    public async Task Handle_ArticleDocumentTerm_SetsSourceKindToArticle()
    {
        var docId = Guid.NewGuid();
        var term = new GlossaryTerm
        {
            GlossaryTermId = Guid.NewGuid(),
            UserId = _userId,
            DocumentId = docId,
            Term = "Article Term",
            Definition = "Def",
            CreatedAt = DateTime.UtcNow,
            Document = new Document { DocumentId = docId, FileName = "article.md", ContentType = "text/markdown", OriginalUrl = "https://example.com", CourseId = Guid.NewGuid(), UserId = _userId, BlobUrl = "", CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow },
        };
        _terms.Setup(r => r.GetByUserWithSourcesAsync(_userId, default)).ReturnsAsync(new[] { term });

        var result = await _handler.Handle(new GetAllGlossaryTermsQuery(_userId), default);

        Assert.Equal("article", result.Data!.First().SourceKind);
    }
}
