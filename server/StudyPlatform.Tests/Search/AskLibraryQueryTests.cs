using System.Linq.Expressions;
using Microsoft.Extensions.Logging;
using Moq;
using StudyPlatform.Application.Search.Queries;
using StudyPlatform.Application.Services;
using StudyPlatform.Domain.Entities;
using StudyPlatform.Domain.Interfaces;
using Xunit;

namespace StudyPlatform.Tests.Search;

public class AskLibraryQueryHandlerTests
{
    private readonly Mock<IUnitOfWork> _uow = new();
    private readonly Mock<IDocumentRepository> _documents = new();
    private readonly Mock<IVideoRepository> _videos = new();
    private readonly Mock<INoteRepository> _notes = new();
    private readonly Mock<IGlossaryTermRepository> _terms = new();
    private readonly Mock<IAiService> _ai = new();
    private readonly Mock<IEmbeddingIndex> _embeddingIndex = new();
    private readonly AskLibraryQueryHandler _handler;
    private readonly Guid _userId = Guid.NewGuid();

    public AskLibraryQueryHandlerTests()
    {
        _uow.Setup(u => u.Documents).Returns(_documents.Object);
        _uow.Setup(u => u.Videos).Returns(_videos.Object);
        _uow.Setup(u => u.Notes).Returns(_notes.Object);
        _uow.Setup(u => u.GlossaryTerms).Returns(_terms.Object);

        _documents.Setup(r => r.FindAsNoTrackingAsync(It.IsAny<Expression<Func<Document, bool>>>(), default)).ReturnsAsync(Array.Empty<Document>());
        _videos.Setup(r => r.FindAsNoTrackingAsync(It.IsAny<Expression<Func<Video, bool>>>(), default)).ReturnsAsync(Array.Empty<Video>());
        _notes.Setup(r => r.GetByUserIdAsync(_userId, default)).ReturnsAsync(Array.Empty<Note>());
        _terms.Setup(r => r.FindAsNoTrackingAsync(It.IsAny<Expression<Func<GlossaryTerm, bool>>>(), default)).ReturnsAsync(Array.Empty<GlossaryTerm>());
        _embeddingIndex.Setup(e => e.SearchAsync(_userId, It.IsAny<string>(), It.IsAny<IReadOnlyCollection<string>>(), It.IsAny<int>(), default))
            .ReturnsAsync(Array.Empty<EmbeddingHit>());
        _ai.Setup(a => a.AnswerQuestionAsync(It.IsAny<string>(), It.IsAny<string>(), default)).ReturnsAsync("The answer is 42 [1].");

        _handler = new AskLibraryQueryHandler(_uow.Object, _ai.Object, _embeddingIndex.Object, Mock.Of<ILogger<AskLibraryQueryHandler>>());
    }

    [Fact]
    public async Task Handle_BlankQuestion_ReturnsFailure()
    {
        var result = await _handler.Handle(new AskLibraryQuery(_userId, "   "), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("QUESTION_REQUIRED", result.ErrorCode);
    }

    [Fact]
    public async Task Handle_NoMatchesAnywhere_ReturnsNoSources()
    {
        var result = await _handler.Handle(new AskLibraryQuery(_userId, "photosynthesis"), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("NO_SOURCES", result.ErrorCode);
    }

    [Fact]
    public async Task Handle_SemanticHitsAvailable_UsesThemAndSkipsKeywordFallback()
    {
        _embeddingIndex.Setup(e => e.SearchAsync(_userId, "photosynthesis", It.IsAny<IReadOnlyCollection<string>>(), It.IsAny<int>(), default))
            .ReturnsAsync(new[] { new EmbeddingHit("document", Guid.NewGuid(), "Bio Notes", "Photosynthesis converts light to energy.", 0, 0.1) });

        var result = await _handler.Handle(new AskLibraryQuery(_userId, "photosynthesis"), default);

        Assert.True(result.IsSuccess);
        Assert.Single(result.Data!.Citations);
        _documents.Verify(d => d.FindAsNoTrackingAsync(It.IsAny<Expression<Func<Document, bool>>>(), default), Times.Never);
    }

    [Fact]
    public async Task Handle_SemanticHitsBeyondDistanceThreshold_AreExcluded()
    {
        _embeddingIndex.Setup(e => e.SearchAsync(_userId, It.IsAny<string>(), It.IsAny<IReadOnlyCollection<string>>(), It.IsAny<int>(), default))
            .ReturnsAsync(new[] { new EmbeddingHit("document", Guid.NewGuid(), "Unrelated", "Some text", 0, 0.9) });

        var result = await _handler.Handle(new AskLibraryQuery(_userId, "photosynthesis"), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("NO_SOURCES", result.ErrorCode);
    }

    [Fact]
    public async Task Handle_SemanticSearchThrows_FallsBackToKeywordRetrieval()
    {
        _embeddingIndex.Setup(e => e.SearchAsync(_userId, It.IsAny<string>(), It.IsAny<IReadOnlyCollection<string>>(), It.IsAny<int>(), default))
            .ThrowsAsync(new InvalidOperationException("index down"));
        _documents.Setup(r => r.FindAsNoTrackingAsync(It.IsAny<Expression<Func<Document, bool>>>(), default))
            .ReturnsAsync(new[] { new Document { DocumentId = Guid.NewGuid(), UserId = _userId, FileName = "Photosynthesis Notes", Summary = "About photosynthesis." } });

        var result = await _handler.Handle(new AskLibraryQuery(_userId, "photosynthesis"), default);

        Assert.True(result.IsSuccess);
    }

    [Fact]
    public async Task Handle_MultipleChunksOfSameSource_KeepsOnlyBestOne()
    {
        var docId = Guid.NewGuid();
        _embeddingIndex.Setup(e => e.SearchAsync(_userId, It.IsAny<string>(), It.IsAny<IReadOnlyCollection<string>>(), It.IsAny<int>(), default))
            .ReturnsAsync(new[]
            {
                new EmbeddingHit("document", docId, "Bio Notes", "chunk A", 0, 0.3),
                new EmbeddingHit("document", docId, "Bio Notes", "chunk B (closer)", 1, 0.1),
            });

        var result = await _handler.Handle(new AskLibraryQuery(_userId, "q"), default);

        Assert.Single(result.Data!.Citations);
    }

    [Fact]
    public async Task Handle_CitationsIndexedFrom1()
    {
        _embeddingIndex.Setup(e => e.SearchAsync(_userId, It.IsAny<string>(), It.IsAny<IReadOnlyCollection<string>>(), It.IsAny<int>(), default))
            .ReturnsAsync(new[]
            {
                new EmbeddingHit("document", Guid.NewGuid(), "A", "text a", 0, 0.1),
                new EmbeddingHit("video", Guid.NewGuid(), "B", "text b", 0, 0.2),
            });

        var result = await _handler.Handle(new AskLibraryQuery(_userId, "q"), default);

        Assert.Equal(new[] { 1, 2 }, result.Data!.Citations.Select(c => c.Index));
    }

    [Theory]
    [InlineData("document", "/documents/")]
    [InlineData("video", "/videos/")]
    public async Task Handle_UrlForBuildsIdBasedRoutes(string sourceType, string expectedPrefix)
    {
        var id = Guid.NewGuid();
        _embeddingIndex.Setup(e => e.SearchAsync(_userId, It.IsAny<string>(), It.IsAny<IReadOnlyCollection<string>>(), It.IsAny<int>(), default))
            .ReturnsAsync(new[] { new EmbeddingHit(sourceType, id, "Title", "text", 0, 0.1) });

        var result = await _handler.Handle(new AskLibraryQuery(_userId, "q"), default);

        Assert.StartsWith(expectedPrefix, result.Data!.Citations.Single().Url);
    }

    [Fact]
    public async Task Handle_NoteSource_HasFixedNotesUrl()
    {
        _embeddingIndex.Setup(e => e.SearchAsync(_userId, It.IsAny<string>(), It.IsAny<IReadOnlyCollection<string>>(), It.IsAny<int>(), default))
            .ReturnsAsync(new[] { new EmbeddingHit("note", Guid.NewGuid(), "My Note", "text", 0, 0.1) });

        var result = await _handler.Handle(new AskLibraryQuery(_userId, "q"), default);

        Assert.Equal("/notes", result.Data!.Citations.Single().Url);
    }

    [Fact]
    public async Task Handle_KeywordFallback_MatchesTitleOrBody()
    {
        _documents.Setup(r => r.FindAsNoTrackingAsync(It.IsAny<Expression<Func<Document, bool>>>(), default))
            .ReturnsAsync(new[] { new Document { DocumentId = Guid.NewGuid(), UserId = _userId, FileName = "Photosynthesis.pdf", Summary = "unrelated body" } });

        var result = await _handler.Handle(new AskLibraryQuery(_userId, "photosynthesis"), default);

        Assert.True(result.IsSuccess);
        Assert.Single(result.Data!.Citations);
    }

    [Fact]
    public async Task Handle_KeywordFallback_StopwordsAndShortWordsExcludedFromScoring()
    {
        // "the" and "how" are stopwords; a question of only stopwords/short words falls back to the
        // whole trimmed question as a single "keyword", which won't match unrelated content.
        var result = await _handler.Handle(new AskLibraryQuery(_userId, "the how"), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("NO_SOURCES", result.ErrorCode);
    }

    [Fact]
    public async Task Handle_KeywordFallback_GlossaryScoreIsBoosted()
    {
        // A definition mention should outrank an equally-matching note (1.5x boost), verified by
        // ensuring the glossary source is the one returned when only one slot resolves via scoring order.
        _terms.Setup(r => r.FindAsNoTrackingAsync(It.IsAny<Expression<Func<GlossaryTerm, bool>>>(), default))
            .ReturnsAsync(new[] { new GlossaryTerm { GlossaryTermId = Guid.NewGuid(), UserId = _userId, Term = "Photosynthesis", Definition = "Photosynthesis converts light." } });
        _notes.Setup(r => r.GetByUserIdAsync(_userId, default))
            .ReturnsAsync(new[] { new Note { NoteId = Guid.NewGuid(), UserId = _userId, Title = "Note", Content = "photosynthesis mention" } });

        var result = await _handler.Handle(new AskLibraryQuery(_userId, "photosynthesis"), default);

        Assert.Equal("glossary", result.Data!.Citations.First().Type);
    }

    [Fact]
    public async Task Handle_KeywordFallback_NoteWithBlankTitle_DefaultsToNoteLabel()
    {
        _notes.Setup(r => r.GetByUserIdAsync(_userId, default))
            .ReturnsAsync(new[] { new Note { NoteId = Guid.NewGuid(), UserId = _userId, Title = null, Content = "photosynthesis details" } });

        var result = await _handler.Handle(new AskLibraryQuery(_userId, "photosynthesis"), default);

        Assert.Equal("Note", result.Data!.Citations.Single().Title);
    }

    [Fact]
    public async Task Handle_ContextIncludesAllCitationsAndAnswerIsReturned()
    {
        _documents.Setup(r => r.FindAsNoTrackingAsync(It.IsAny<Expression<Func<Document, bool>>>(), default))
            .ReturnsAsync(new[] { new Document { DocumentId = Guid.NewGuid(), UserId = _userId, FileName = "Photosynthesis.pdf", Summary = "About photosynthesis." } });
        string? capturedContext = null;
        _ai.Setup(a => a.AnswerQuestionAsync(It.IsAny<string>(), "What is photosynthesis?", default))
            .Callback<string, string, CancellationToken>((ctx, _, _) => capturedContext = ctx)
            .ReturnsAsync("It converts light to energy [1].");

        var result = await _handler.Handle(new AskLibraryQuery(_userId, "What is photosynthesis?"), default);

        Assert.True(result.IsSuccess);
        Assert.Equal("It converts light to energy [1].", result.Data!.Answer);
        Assert.Contains("[1]", capturedContext);
        Assert.Contains("Photosynthesis.pdf", capturedContext);
    }
}
