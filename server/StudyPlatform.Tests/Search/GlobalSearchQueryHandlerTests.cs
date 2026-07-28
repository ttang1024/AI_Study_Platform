using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using StudyPlatform.Application.Common;
using StudyPlatform.Application.Search.Queries;
using StudyPlatform.Application.Services;
using StudyPlatform.Domain.Entities;
using StudyPlatform.Domain.Interfaces;
using Xunit;

namespace StudyPlatform.Tests.Search;

public class GlobalSearchQueryHandlerTests
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

    /// <summary>
    /// Stands in for EF Core's one-operation-at-a-time rule on a scoped DbContext: every repository the
    /// handler touches shares this, and a second overlapping call throws exactly as the real context does.
    /// </summary>
    private readonly SingleOperationGuard _guard = new();

    public GlobalSearchQueryHandlerTests()
    {
        _uow.Setup(u => u.Documents).Returns(_documents.Object);
        _uow.Setup(u => u.Videos).Returns(_videos.Object);
        _uow.Setup(u => u.Notes).Returns(_notes.Object);
        _uow.Setup(u => u.Flashcards).Returns(_flashcards.Object);
        _uow.Setup(u => u.GlossaryTerms).Returns(_glossary.Object);

        _documents.Setup(r => r.SearchByUserAsync(_userId, It.IsAny<string>(), It.IsAny<int>(), default))
            .Returns(() => _guard.RunAsync<IEnumerable<Document>>(
                [new Document { DocumentId = Guid.NewGuid(), FileName = "AI agents.pdf", Summary = "About AI agents." }]));
        _videos.Setup(r => r.SearchByUserAsync(_userId, It.IsAny<string>(), It.IsAny<int>(), default))
            .Returns(() => _guard.RunAsync<IEnumerable<Video>>(
                [new Video { VideoId = Guid.NewGuid(), Title = "AI Agents Explained" }]));
        _notes.Setup(r => r.SearchByUserAsync(_userId, It.IsAny<string>(), It.IsAny<int>(), default))
            .Returns(() => _guard.RunAsync<IEnumerable<Note>>(
                [new Note { NoteId = Guid.NewGuid(), Title = "Agents", Content = "AI agents notes" }]));
        _flashcards.Setup(r => r.SearchByUserAsync(_userId, It.IsAny<string>(), It.IsAny<int>(), default))
            .Returns(() => _guard.RunAsync<IEnumerable<Flashcard>>(
                [new Flashcard { FlashcardId = Guid.NewGuid(), Front = "What is an AI agent?", Back = "A loop." }]));
        _glossary.Setup(r => r.SearchByUserAsync(_userId, It.IsAny<string>(), It.IsAny<int>(), default))
            .Returns(() => _guard.RunAsync<IEnumerable<GlossaryTerm>>(
                [new GlossaryTerm { GlossaryTermId = Guid.NewGuid(), Term = "AI agent", Definition = "An LLM in a loop." }]));

        _embeddingIndex
            .Setup(i => i.SearchAsync(_userId, It.IsAny<string>(), It.IsAny<IReadOnlyCollection<string>>(), It.IsAny<int>(), default))
            .Returns(() => _guard.RunAsync<IReadOnlyList<EmbeddingHit>>([]));

        _handler = new GlobalSearchQueryHandler(
            _uow.Object, _embeddingIndex.Object, NullLogger<GlobalSearchQueryHandler>.Instance);
    }

    private Task<Result<SearchResultsDto>> Search(string[]? types) =>
        _handler.Handle(new GlobalSearchQuery(_userId, "ai agent", types, 1, 20), default);

    [Fact]
    public async Task Handle_WithNoTypesRequested_SearchesEveryCategory()
    {
        // ASP.NET Core binds a missing `types` query parameter to an empty array, not null, so this is
        // what the UI's unfiltered "All" tab actually sends. Treating it as "match nothing" made every
        // unfiltered search return zero results.
        var result = await Search([]);

        var types = result.Data!.Items.Select(i => i.Type).ToHashSet();
        Assert.Equal(new[] { "document", "flashcard", "glossary", "note", "video" }, types.OrderBy(t => t));
    }

    [Fact]
    public async Task Handle_WithNullTypes_SearchesEveryCategory()
    {
        var result = await Search(null);
        Assert.Equal(5, result.Data!.TotalCount);
    }

    [Fact]
    public async Task Handle_WithExplicitTypes_SearchesOnlyThose()
    {
        var result = await Search(["glossary"]);

        Assert.Equal(["glossary"], result.Data!.Items.Select(i => i.Type));
        _documents.Verify(r => r.SearchByUserAsync(It.IsAny<Guid>(), It.IsAny<string>(), It.IsAny<int>(), default), Times.Never);
    }

    [Fact]
    public async Task Handle_WithDocumentsInScope_IncludesVideos()
    {
        // A video with no transcript has nothing in the embedding index, so keyword matching on its
        // title is the only thing that can find it.
        var result = await Search(["documents"]);

        var video = Assert.Single(result.Data!.Items, i => i.Type == "video");
        Assert.Equal("AI Agents Explained", video.Title);
        Assert.StartsWith("/videos/", video.Url);
    }

    [Fact]
    public async Task Handle_NeverRunsTwoRepositoryCallsConcurrently()
    {
        // Running the category searches under Task.WhenAll shared one scoped DbContext across them and
        // failed the whole request with "a second operation was started on this context instance".
        var result = await Search([]);

        Assert.True(result.IsSuccess);
        Assert.Null(_guard.Overlap);
    }

    private sealed class SingleOperationGuard
    {
        private int _inFlight;

        public string? Overlap { get; private set; }

        public async Task<T> RunAsync<T>(T value)
        {
            if (Interlocked.Increment(ref _inFlight) > 1)
            {
                Overlap = "A second operation was started on this context instance before a previous operation completed.";
                Interlocked.Decrement(ref _inFlight);
                throw new InvalidOperationException(Overlap);
            }

            try
            {
                // Yield so overlapping callers actually interleave rather than completing synchronously.
                await Task.Delay(5);
                return value;
            }
            finally
            {
                Interlocked.Decrement(ref _inFlight);
            }
        }
    }
}
