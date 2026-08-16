using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using StudyPlatform.Application.Search.Queries;
using StudyPlatform.Application.Services;
using StudyPlatform.Domain.Entities;
using StudyPlatform.Domain.Interfaces;
using Xunit;

namespace StudyPlatform.Tests.Search;

public class GlobalSearchQuerySemanticAndEdgeCaseTests
{
    private readonly Mock<IUnitOfWork> _uow = new();
    private readonly Mock<IDocumentRepository> _documents = new();
    private readonly Mock<IVideoRepository> _videos = new();
    private readonly Mock<INoteRepository> _notes = new();
    private readonly Mock<IFlashcardRepository> _flashcards = new();
    private readonly Mock<IGlossaryTermRepository> _glossary = new();
    private readonly Mock<IEmbeddingIndex> _embeddingIndex = new();
    private readonly GlobalSearchQueryHandler _handler;
    private readonly Guid _userId = Guid.NewGuid();

    public GlobalSearchQuerySemanticAndEdgeCaseTests()
    {
        _uow.Setup(u => u.Documents).Returns(_documents.Object);
        _uow.Setup(u => u.Videos).Returns(_videos.Object);
        _uow.Setup(u => u.Notes).Returns(_notes.Object);
        _uow.Setup(u => u.Flashcards).Returns(_flashcards.Object);
        _uow.Setup(u => u.GlossaryTerms).Returns(_glossary.Object);

        _documents.Setup(r => r.SearchByUserAsync(_userId, It.IsAny<string>(), It.IsAny<int>(), default))
            .ReturnsAsync(Array.Empty<Document>());
        _videos.Setup(r => r.SearchByUserAsync(_userId, It.IsAny<string>(), It.IsAny<int>(), default))
            .ReturnsAsync(Array.Empty<Video>());
        _notes.Setup(r => r.SearchByUserAsync(_userId, It.IsAny<string>(), It.IsAny<int>(), default))
            .ReturnsAsync(Array.Empty<Note>());
        _flashcards.Setup(r => r.SearchByUserAsync(_userId, It.IsAny<string>(), It.IsAny<int>(), default))
            .ReturnsAsync(Array.Empty<Flashcard>());
        _glossary.Setup(r => r.SearchByUserAsync(_userId, It.IsAny<string>(), It.IsAny<int>(), default))
            .ReturnsAsync(Array.Empty<GlossaryTerm>());
        _embeddingIndex
            .Setup(i => i.SearchAsync(_userId, It.IsAny<string>(), It.IsAny<IReadOnlyCollection<string>>(), It.IsAny<int>(), default))
            .ReturnsAsync(Array.Empty<EmbeddingHit>());

        _handler = new GlobalSearchQueryHandler(
            _uow.Object, _embeddingIndex.Object, NullLogger<GlobalSearchQueryHandler>.Instance);
    }

    [Fact]
    public async Task Handle_BlankQuery_ReturnsEmptyWithoutSearching()
    {
        var result = await _handler.Handle(new GlobalSearchQuery(_userId, "   ", null, 1, 20), default);

        Assert.True(result.IsSuccess);
        Assert.Empty(result.Data!.Items);
        Assert.Equal(0, result.Data.TotalCount);
        _documents.Verify(r => r.SearchByUserAsync(It.IsAny<Guid>(), It.IsAny<string>(), It.IsAny<int>(), default), Times.Never);
    }

    [Fact]
    public async Task Handle_SemanticHitsWithinThreshold_AreIncluded()
    {
        var docId = Guid.NewGuid();
        _embeddingIndex
            .Setup(i => i.SearchAsync(_userId, It.IsAny<string>(), It.IsAny<IReadOnlyCollection<string>>(), It.IsAny<int>(), default))
            .ReturnsAsync(new[] { new EmbeddingHit("document", docId, "Doc Title", "Some matching text here.", 0, 0.3) });

        var result = await _handler.Handle(new GlobalSearchQuery(_userId, "concept", ["documents"], 1, 20), default);

        var item = Assert.Single(result.Data!.Items);
        Assert.Equal("document", item.Type);
        Assert.Equal($"/documents/{docId}", item.Url);
    }

    [Fact]
    public async Task Handle_SemanticHitsBeyondThreshold_AreExcluded()
    {
        var docId = Guid.NewGuid();
        _embeddingIndex
            .Setup(i => i.SearchAsync(_userId, It.IsAny<string>(), It.IsAny<IReadOnlyCollection<string>>(), It.IsAny<int>(), default))
            .ReturnsAsync(new[] { new EmbeddingHit("document", docId, "Doc Title", "Irrelevant text.", 0, 0.9) });

        var result = await _handler.Handle(new GlobalSearchQuery(_userId, "concept", ["documents"], 1, 20), default);

        Assert.Empty(result.Data!.Items);
    }

    [Fact]
    public async Task Handle_MultipleChunksFromSameSource_ShowsBestOnly()
    {
        var docId = Guid.NewGuid();
        _embeddingIndex
            .Setup(i => i.SearchAsync(_userId, It.IsAny<string>(), It.IsAny<IReadOnlyCollection<string>>(), It.IsAny<int>(), default))
            .ReturnsAsync(new[]
            {
                new EmbeddingHit("document", docId, "Doc Title", "Chunk 1 text.", 0, 0.4),
                new EmbeddingHit("document", docId, "Doc Title", "Chunk 2 text, closer match.", 1, 0.2),
            });

        var result = await _handler.Handle(new GlobalSearchQuery(_userId, "concept", ["documents"], 1, 20), default);

        var item = Assert.Single(result.Data!.Items);
        Assert.Contains("closer match", item.Snippet);
    }

    [Fact]
    public async Task Handle_SemanticAndKeywordFindSameEntity_DedupesInFavorOfKeyword()
    {
        var docId = Guid.NewGuid();
        _documents.Setup(r => r.SearchByUserAsync(_userId, It.IsAny<string>(), It.IsAny<int>(), default))
            .ReturnsAsync(new[] { new Document { DocumentId = docId, FileName = "match.pdf", Summary = "keyword hit" } });
        _embeddingIndex
            .Setup(i => i.SearchAsync(_userId, It.IsAny<string>(), It.IsAny<IReadOnlyCollection<string>>(), It.IsAny<int>(), default))
            .ReturnsAsync(new[] { new EmbeddingHit("document", docId, "match.pdf", "semantic hit", 0, 0.1) });

        var result = await _handler.Handle(new GlobalSearchQuery(_userId, "match", ["documents"], 1, 20), default);

        Assert.Single(result.Data!.Items);
    }

    [Fact]
    public async Task Handle_EmbeddingSearchThrows_FallsBackToKeywordOnlyResults()
    {
        _documents.Setup(r => r.SearchByUserAsync(_userId, It.IsAny<string>(), It.IsAny<int>(), default))
            .ReturnsAsync(new[] { new Document { DocumentId = Guid.NewGuid(), FileName = "a.pdf", Summary = "keyword only" } });
        _embeddingIndex
            .Setup(i => i.SearchAsync(_userId, It.IsAny<string>(), It.IsAny<IReadOnlyCollection<string>>(), It.IsAny<int>(), default))
            .ThrowsAsync(new InvalidOperationException("embedding service unavailable"));

        var result = await _handler.Handle(new GlobalSearchQuery(_userId, "keyword", ["documents"], 1, 20), default);

        Assert.True(result.IsSuccess);
        Assert.Single(result.Data!.Items);
    }

    [Fact]
    public async Task Handle_NoCategoriesHaveSemanticCoverage_SkipsEmbeddingCall()
    {
        var result = await _handler.Handle(new GlobalSearchQuery(_userId, "term", ["flashcards"], 1, 20), default);

        Assert.True(result.IsSuccess);
        _embeddingIndex.Verify(i => i.SearchAsync(
            It.IsAny<Guid>(), It.IsAny<string>(), It.IsAny<IReadOnlyCollection<string>>(), It.IsAny<int>(), default), Times.Never);
    }

    [Fact]
    public async Task Handle_Pagination_ReturnsCorrectPageAndTotalCount()
    {
        _documents.Setup(r => r.SearchByUserAsync(_userId, It.IsAny<string>(), It.IsAny<int>(), default))
            .ReturnsAsync(Enumerable.Range(0, 5).Select(i => new Document { DocumentId = Guid.NewGuid(), FileName = $"doc{i}.pdf", Summary = "term" }));

        var result = await _handler.Handle(new GlobalSearchQuery(_userId, "term", ["documents"], 2, 2), default);

        Assert.Equal(2, result.Data!.Items.Count());
        Assert.Equal(5, result.Data.TotalCount);
        Assert.Equal(2, result.Data.Page);
    }

    [Fact]
    public async Task Handle_QueryNotFoundInText_SnippetTakesLeadingSubstring()
    {
        var longText = new string('a', 200);
        _documents.Setup(r => r.SearchByUserAsync(_userId, It.IsAny<string>(), It.IsAny<int>(), default))
            .ReturnsAsync(new[] { new Document { DocumentId = Guid.NewGuid(), FileName = "match.pdf", Summary = longText } });

        var result = await _handler.Handle(new GlobalSearchQuery(_userId, "match", ["documents"], 1, 20), default);

        var item = Assert.Single(result.Data!.Items);
        Assert.EndsWith("...", item.Snippet);
        Assert.True(item.Snippet.Length <= 153);
    }

    [Fact]
    public async Task Handle_NoteWithNullTitle_UsesContentPrefixAsTitle()
    {
        var longContent = new string('x', 100);
        _notes.Setup(r => r.SearchByUserAsync(_userId, It.IsAny<string>(), It.IsAny<int>(), default))
            .ReturnsAsync(new[] { new Note { NoteId = Guid.NewGuid(), Title = null, Content = longContent } });

        var result = await _handler.Handle(new GlobalSearchQuery(_userId, "x", ["notes"], 1, 20), default);

        var item = Assert.Single(result.Data!.Items);
        Assert.Equal(new string('x', 60), item.Title);
    }

    [Fact]
    public async Task Handle_FlashcardResult_LinksToFlashcardsPage()
    {
        _flashcards.Setup(r => r.SearchByUserAsync(_userId, It.IsAny<string>(), It.IsAny<int>(), default))
            .ReturnsAsync(new[] { new Flashcard { FlashcardId = Guid.NewGuid(), Front = "term question", Back = "term answer" } });

        var result = await _handler.Handle(new GlobalSearchQuery(_userId, "term", ["flashcards"], 1, 20), default);

        var item = Assert.Single(result.Data!.Items);
        Assert.Equal("/flashcards", item.Url);
    }

    [Fact]
    public async Task Handle_GlossaryResult_LinksToGlossaryPage()
    {
        _glossary.Setup(r => r.SearchByUserAsync(_userId, It.IsAny<string>(), It.IsAny<int>(), default))
            .ReturnsAsync(new[] { new GlossaryTerm { GlossaryTermId = Guid.NewGuid(), Term = "term", Definition = "a definition" } });

        var result = await _handler.Handle(new GlobalSearchQuery(_userId, "term", ["glossary"], 1, 20), default);

        var item = Assert.Single(result.Data!.Items);
        Assert.Equal("/glossary", item.Url);
    }
}
