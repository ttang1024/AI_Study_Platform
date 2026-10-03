using System.Text.Json;
using Moq;
using StudyPlatform.Application.Documents.Commands;
using StudyPlatform.Application.Services;
using StudyPlatform.Domain.Entities;
using StudyPlatform.Domain.Interfaces;
using Xunit;

namespace StudyPlatform.Tests.Documents;

public class GenerateFlashcardsCommandEdgeCaseTests
{
    private readonly Mock<IUnitOfWork> _uow = new();
    private readonly Mock<IDocumentRepository> _documents = new();
    private readonly Mock<IFlashcardRepository> _flashcards = new();
    private readonly Mock<IAiService> _ai = new();
    private readonly Mock<IDocumentContentService> _content = new();
    private readonly Mock<IDocumentTextProvider> _textProvider = new();
    private readonly Mock<IFlashcardDeduplicator> _deduplicator = new();
    private readonly GenerateFlashcardsCommandHandler _handler;

    private readonly Guid _userId = Guid.NewGuid();
    private readonly Guid _docId = Guid.NewGuid();
    private readonly Document _doc;

    public GenerateFlashcardsCommandEdgeCaseTests()
    {
        _uow.Setup(u => u.Documents).Returns(_documents.Object);
        _uow.Setup(u => u.Flashcards).Returns(_flashcards.Object);
        _uow.Setup(u => u.SaveChangesAsync(default)).ReturnsAsync(1);
        _flashcards.Setup(r => r.AddRangeAsync(It.IsAny<IEnumerable<Flashcard>>(), default)).Returns(Task.CompletedTask);
        _flashcards.Setup(r => r.GetByDocumentIdAsync(_docId, default)).ReturnsAsync(Array.Empty<Flashcard>());

        _doc = new Document { DocumentId = _docId, UserId = _userId, ContentType = "text/plain", BlobUrl = "blob://test" };
        _documents.Setup(r => r.GetByIdAsync(_docId, default)).ReturnsAsync(_doc);
        _content.Setup(c => c.GetContentAsync(_doc, default)).ReturnsAsync(new DocumentContent(null, "text"));

        _handler = new GenerateFlashcardsCommandHandler(
            _uow.Object, _ai.Object, _content.Object, _deduplicator.Object, _textProvider.Object);
    }

    private static string FlashcardsJson() => JsonSerializer.Serialize(new[]
    {
        new { Front = "Q1", Back = "A1" },
        new { Front = "Q2", Back = "A2" },
    });

    [Fact]
    public async Task Handle_AllCandidatesDeduped_ReturnsEmptyWithoutSaving()
    {
        _ai.Setup(a => a.GenerateFlashcardsAsync("text", default)).ReturnsAsync(FlashcardsJson());
        _deduplicator
            .Setup(d => d.FilterAsync(_userId, It.IsAny<IReadOnlyList<FlashcardCandidate>>(), default))
            .ReturnsAsync((Guid _, IReadOnlyList<FlashcardCandidate> candidates, CancellationToken _) =>
                new FlashcardDedupResult([], candidates, []));

        var result = await _handler.Handle(new GenerateFlashcardsCommand(_docId, _userId), default);

        Assert.True(result.IsSuccess);
        Assert.Empty(result.Data!);
        Assert.Equal("Every generated flashcard duplicates one you already have.", result.Message);
        _flashcards.Verify(r => r.AddRangeAsync(It.IsAny<IEnumerable<Flashcard>>(), default), Times.Never);
        _uow.Verify(u => u.SaveChangesAsync(default), Times.Never);
    }

    [Fact]
    public async Task Handle_PartialDuplicates_MessageReportsSkippedCount()
    {
        _ai.Setup(a => a.GenerateFlashcardsAsync("text", default)).ReturnsAsync(FlashcardsJson());
        _deduplicator
            .Setup(d => d.FilterAsync(_userId, It.IsAny<IReadOnlyList<FlashcardCandidate>>(), default))
            .ReturnsAsync((Guid _, IReadOnlyList<FlashcardCandidate> candidates, CancellationToken _) =>
                new FlashcardDedupResult([candidates[0]], [candidates[1]], []));

        var result = await _handler.Handle(new GenerateFlashcardsCommand(_docId, _userId), default);

        Assert.True(result.IsSuccess);
        Assert.Single(result.Data!);
        Assert.Contains("skipped 1", result.Message);
    }

    [Fact]
    public async Task Handle_ChartGroupedJson_AssignsChartCardType()
    {
        _deduplicator
            .Setup(d => d.FilterAsync(_userId, It.IsAny<IReadOnlyList<FlashcardCandidate>>(), default))
            .ReturnsAsync((Guid _, IReadOnlyList<FlashcardCandidate> c, CancellationToken _) => FlashcardDedupResult.KeepAll(c));
        var json = """{"charts":[{"front":"Label the diagram","back":"","chartData":{"type":"bar"}}]}""";
        _ai.Setup(a => a.GenerateFlashcardsAsync("text", default)).ReturnsAsync(json);

        Flashcard? saved = null;
        _flashcards.Setup(r => r.AddRangeAsync(It.IsAny<IEnumerable<Flashcard>>(), default))
            .Callback<IEnumerable<Flashcard>, CancellationToken>((fcs, _) => saved = fcs.First())
            .Returns(Task.CompletedTask);

        var result = await _handler.Handle(new GenerateFlashcardsCommand(_docId, _userId), default);

        Assert.True(result.IsSuccess);
        Assert.Equal("chart", saved!.CardType);
    }
}

public class GenerateGlossaryCommandEdgeCaseTests
{
    private readonly Mock<IUnitOfWork> _uow = new();
    private readonly Mock<IDocumentRepository> _documents = new();
    private readonly Mock<IGlossaryTermRepository> _glossary = new();
    private readonly Mock<IAiService> _ai = new();
    private readonly Mock<IDocumentContentService> _content = new();
    private readonly Mock<IDocumentTextProvider> _textProvider = new();
    private readonly GenerateGlossaryCommandHandler _handler;

    private readonly Guid _userId = Guid.NewGuid();
    private readonly Guid _docId = Guid.NewGuid();
    private readonly Document _doc;

    public GenerateGlossaryCommandEdgeCaseTests()
    {
        _uow.Setup(u => u.Documents).Returns(_documents.Object);
        _uow.Setup(u => u.GlossaryTerms).Returns(_glossary.Object);
        _uow.Setup(u => u.SaveChangesAsync(default)).ReturnsAsync(1);

        _doc = new Document { DocumentId = _docId, UserId = _userId, ContentType = "text/plain", BlobUrl = "blob://test" };
        _documents.Setup(r => r.GetByIdAsync(_docId, default)).ReturnsAsync(_doc);
        _content.Setup(c => c.GetContentAsync(_doc, default)).ReturnsAsync(new DocumentContent(null, "text"));

        _handler = new GenerateGlossaryCommandHandler(_uow.Object, _ai.Object, _content.Object, _textProvider.Object);
    }

    [Fact]
    public async Task Handle_UnexpectedExceptionDuringGeneration_ReturnsGenerationFailed()
    {
        _glossary.Setup(r => r.DeleteByDocumentIdAsync(_docId, default))
            .ThrowsAsync(new InvalidOperationException("db unavailable"));

        var result = await _handler.Handle(new GenerateGlossaryCommand(_docId, _userId), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("GENERATION_FAILED", result.ErrorCode);
        Assert.Contains("db unavailable", result.Message);
    }
}
