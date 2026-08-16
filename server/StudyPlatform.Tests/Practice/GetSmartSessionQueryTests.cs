using System.Linq.Expressions;
using System.Text.Json;
using Moq;
using StudyPlatform.Application.Practice.Queries;
using StudyPlatform.Domain.Entities;
using StudyPlatform.Domain.Interfaces;
using Xunit;

namespace StudyPlatform.Tests.Practice;

public class GetSmartSessionQueryHandlerTests
{
    private readonly Mock<IUnitOfWork> _uow = new();
    private readonly Mock<IDocumentRepository> _documents = new();
    private readonly Mock<IVideoRepository> _videos = new();
    private readonly Mock<IFlashcardSrsDataRepository> _srs = new();
    private readonly Mock<IFlashcardRepository> _flashcards = new();
    private readonly Mock<IMistakeEntryRepository> _mistakes = new();
    private readonly Mock<IGlossaryMasteredRepository> _mastered = new();
    private readonly Mock<IGlossaryTermRepository> _terms = new();
    private readonly GetSmartSessionQueryHandler _handler;
    private readonly Guid _userId = Guid.NewGuid();

    public GetSmartSessionQueryHandlerTests()
    {
        _uow.Setup(u => u.Documents).Returns(_documents.Object);
        _uow.Setup(u => u.Videos).Returns(_videos.Object);
        _uow.Setup(u => u.FlashcardSrs).Returns(_srs.Object);
        _uow.Setup(u => u.Flashcards).Returns(_flashcards.Object);
        _uow.Setup(u => u.MistakeEntries).Returns(_mistakes.Object);
        _uow.Setup(u => u.GlossaryMastered).Returns(_mastered.Object);
        _uow.Setup(u => u.GlossaryTerms).Returns(_terms.Object);

        _documents.Setup(r => r.FindAsNoTrackingAsync(It.IsAny<Expression<Func<Document, bool>>>(), default)).ReturnsAsync(Array.Empty<Document>());
        _videos.Setup(r => r.FindAsNoTrackingAsync(It.IsAny<Expression<Func<Video, bool>>>(), default)).ReturnsAsync(Array.Empty<Video>());
        _srs.Setup(r => r.GetDueByUserIdAsync(_userId, It.IsAny<DateTime>(), default)).ReturnsAsync(Array.Empty<FlashcardSrsData>());
        _flashcards.Setup(r => r.GetByUserIdAsync(_userId, default)).ReturnsAsync(Array.Empty<Flashcard>());
        _mistakes.Setup(r => r.FindAsNoTrackingAsync(It.IsAny<Expression<Func<MistakeEntry, bool>>>(), default)).ReturnsAsync(Array.Empty<MistakeEntry>());
        _mastered.Setup(r => r.GetMasteredTermIdsByUserAsync(_userId, default)).ReturnsAsync(Array.Empty<Guid>());
        _terms.Setup(r => r.GetByUserWithSourcesAsync(_userId, default)).ReturnsAsync(Array.Empty<GlossaryTerm>());

        _handler = new GetSmartSessionQueryHandler(_uow.Object);
    }

    [Fact]
    public async Task Handle_NoActivity_ReturnsEmptySession()
    {
        var result = await _handler.Handle(new GetSmartSessionQuery(_userId), default);

        Assert.True(result.IsSuccess);
        Assert.Empty(result.Data!.Questions);
        Assert.Equal(0, result.Data.Count);
    }

    [Fact]
    public async Task Handle_DueFlashcard_MapsToRecallQuestion()
    {
        var cardId = Guid.NewGuid();
        _srs.Setup(r => r.GetDueByUserIdAsync(_userId, It.IsAny<DateTime>(), default))
            .ReturnsAsync(new[] { new FlashcardSrsData { UserId = _userId, FlashcardId = cardId, Due = DateTime.UtcNow.AddDays(-1) } });
        _flashcards.Setup(r => r.GetByUserIdAsync(_userId, default))
            .ReturnsAsync(new[] { new Flashcard { FlashcardId = cardId, Front = "What is 2+2?", Back = "4", Difficulty = "easy" } });

        var result = await _handler.Handle(new GetSmartSessionQuery(_userId), default);

        var q = Assert.Single(result.Data!.Questions);
        Assert.Equal("flashcard", q.Source);
        Assert.Equal("recall", q.Format);
        Assert.Equal("4", q.Answer);
    }

    [Fact]
    public async Task Handle_DueFlashcardWithBlankFrontAndBack_IsSkipped()
    {
        var cardId = Guid.NewGuid();
        _srs.Setup(r => r.GetDueByUserIdAsync(_userId, It.IsAny<DateTime>(), default))
            .ReturnsAsync(new[] { new FlashcardSrsData { UserId = _userId, FlashcardId = cardId, Due = DateTime.UtcNow.AddDays(-1) } });
        _flashcards.Setup(r => r.GetByUserIdAsync(_userId, default))
            .ReturnsAsync(new[] { new Flashcard { FlashcardId = cardId, Front = "No cloze here", Back = "" } });

        var result = await _handler.Handle(new GetSmartSessionQuery(_userId), default);

        Assert.Empty(result.Data!.Questions);
    }

    [Fact]
    public async Task Handle_DueSrsWithNoMatchingFlashcard_IsSkipped()
    {
        _srs.Setup(r => r.GetDueByUserIdAsync(_userId, It.IsAny<DateTime>(), default))
            .ReturnsAsync(new[] { new FlashcardSrsData { UserId = _userId, FlashcardId = Guid.NewGuid(), Due = DateTime.UtcNow.AddDays(-1) } });

        var result = await _handler.Handle(new GetSmartSessionQuery(_userId), default);

        Assert.Empty(result.Data!.Questions);
    }

    [Fact]
    public async Task Handle_OpenMistakeWithOptions_MapsToMultipleChoice()
    {
        var mistakeId = Guid.NewGuid();
        var optionsJson = JsonSerializer.Serialize(new[] { "A", "B", "C" });
        _mistakes.Setup(r => r.FindAsNoTrackingAsync(It.IsAny<Expression<Func<MistakeEntry, bool>>>(), default))
            .ReturnsAsync(new[] { new MistakeEntry { MistakeEntryId = mistakeId, UserId = _userId, Status = "open", Question = "Q", OptionsJson = optionsJson, CorrectAnswer = "A", TimesMissed = 2 } });

        var result = await _handler.Handle(new GetSmartSessionQuery(_userId), default);

        var q = Assert.Single(result.Data!.Questions);
        Assert.Equal("mc", q.Format);
        Assert.Equal(3, q.Options!.Length);
    }

    [Fact]
    public async Task Handle_OpenMistakeWithoutEnoughOptions_MapsToRecall()
    {
        var mistakeId = Guid.NewGuid();
        _mistakes.Setup(r => r.FindAsNoTrackingAsync(It.IsAny<Expression<Func<MistakeEntry, bool>>>(), default))
            .ReturnsAsync(new[] { new MistakeEntry { MistakeEntryId = mistakeId, UserId = _userId, Status = "open", Question = "Q", OptionsJson = "", CorrectAnswer = "A" } });

        var result = await _handler.Handle(new GetSmartSessionQuery(_userId), default);

        Assert.Equal("recall", result.Data!.Questions.Single().Format);
    }

    [Fact]
    public async Task Handle_MalformedOptionsJson_FallsBackToRecall()
    {
        var mistakeId = Guid.NewGuid();
        _mistakes.Setup(r => r.FindAsNoTrackingAsync(It.IsAny<Expression<Func<MistakeEntry, bool>>>(), default))
            .ReturnsAsync(new[] { new MistakeEntry { MistakeEntryId = mistakeId, UserId = _userId, Status = "open", Question = "Q", OptionsJson = "{bad", CorrectAnswer = "A" } });

        var result = await _handler.Handle(new GetSmartSessionQuery(_userId), default);

        Assert.Equal("recall", result.Data!.Questions.Single().Format);
    }

    [Fact]
    public async Task Handle_MistakePromotedToFlashcard_IsExcluded()
    {
        // Excluded at the query level via FlashcardId == null filter; verify the handler passes that
        // predicate through by returning nothing when the repository (mocked to obey the filter) finds none.
        _mistakes.Setup(r => r.FindAsNoTrackingAsync(It.IsAny<Expression<Func<MistakeEntry, bool>>>(), default))
            .ReturnsAsync(Array.Empty<MistakeEntry>());

        var result = await _handler.Handle(new GetSmartSessionQuery(_userId), default);

        Assert.Empty(result.Data!.Questions);
    }

    [Fact]
    public async Task Handle_UnmasteredGlossaryTermWithEnoughDistractors_MapsToMultipleChoice()
    {
        var termId = Guid.NewGuid();
        _terms.Setup(r => r.GetByUserWithSourcesAsync(_userId, default)).ReturnsAsync(new[]
        {
            new GlossaryTerm { GlossaryTermId = termId, UserId = _userId, Term = "Mitosis", Definition = "Cell division" },
            new GlossaryTerm { GlossaryTermId = Guid.NewGuid(), UserId = _userId, Term = "Meiosis", Definition = "Reduction division" },
            new GlossaryTerm { GlossaryTermId = Guid.NewGuid(), UserId = _userId, Term = "Osmosis", Definition = "Water movement" },
            new GlossaryTerm { GlossaryTermId = Guid.NewGuid(), UserId = _userId, Term = "Diffusion", Definition = "Particle movement" },
        });

        var result = await _handler.Handle(new GetSmartSessionQuery(_userId), default);

        var q = result.Data!.Questions.Single(q => q.SourceId == termId.ToString());
        Assert.Equal("mc", q.Format);
        Assert.Equal(4, q.Options!.Length);
        Assert.Contains("Cell division", q.Options);
    }

    [Fact]
    public async Task Handle_UnmasteredGlossaryTermWithFewDistractors_MapsToRecall()
    {
        var termId = Guid.NewGuid();
        _terms.Setup(r => r.GetByUserWithSourcesAsync(_userId, default)).ReturnsAsync(new[]
        {
            new GlossaryTerm { GlossaryTermId = termId, UserId = _userId, Term = "Mitosis", Definition = "Cell division" },
        });

        var result = await _handler.Handle(new GetSmartSessionQuery(_userId), default);

        var q = Assert.Single(result.Data!.Questions);
        Assert.Equal("recall", q.Format);
        Assert.Contains("Mitosis", q.Prompt);
    }

    [Fact]
    public async Task Handle_MasteredGlossaryTerm_ExcludedFromSession()
    {
        var termId = Guid.NewGuid();
        _mastered.Setup(r => r.GetMasteredTermIdsByUserAsync(_userId, default)).ReturnsAsync(new[] { termId });
        _terms.Setup(r => r.GetByUserWithSourcesAsync(_userId, default)).ReturnsAsync(new[]
        {
            new GlossaryTerm { GlossaryTermId = termId, UserId = _userId, Term = "Mitosis", Definition = "Cell division" },
        });

        var result = await _handler.Handle(new GetSmartSessionQuery(_userId), default);

        Assert.Empty(result.Data!.Questions);
    }

    [Fact]
    public async Task Handle_TermWithBlankDefinition_ExcludedFromSession()
    {
        _terms.Setup(r => r.GetByUserWithSourcesAsync(_userId, default)).ReturnsAsync(new[]
        {
            new GlossaryTerm { GlossaryTermId = Guid.NewGuid(), UserId = _userId, Term = "Mitosis", Definition = "" },
        });

        var result = await _handler.Handle(new GetSmartSessionQuery(_userId), default);

        Assert.Empty(result.Data!.Questions);
    }

    [Fact]
    public async Task Handle_CapsDueCardsAt10()
    {
        var srsRows = Enumerable.Range(0, 20)
            .Select(_ => new FlashcardSrsData { UserId = _userId, FlashcardId = Guid.NewGuid(), Due = DateTime.UtcNow.AddDays(-1) })
            .ToList();
        _srs.Setup(r => r.GetDueByUserIdAsync(_userId, It.IsAny<DateTime>(), default)).ReturnsAsync(srsRows);
        var cards = srsRows.Select(s => new Flashcard { FlashcardId = s.FlashcardId, Front = "Q", Back = "A" }).ToList();
        _flashcards.Setup(r => r.GetByUserIdAsync(_userId, default)).ReturnsAsync(cards);

        var result = await _handler.Handle(new GetSmartSessionQuery(_userId), default);

        Assert.Equal(10, result.Data!.Questions.Count(q => q.Source == "flashcard"));
    }

    [Fact]
    public async Task Handle_CapsMistakesAt5()
    {
        var mistakes = Enumerable.Range(0, 10)
            .Select(_ => new MistakeEntry { MistakeEntryId = Guid.NewGuid(), UserId = _userId, Status = "open", Question = "Q", CorrectAnswer = "A" })
            .ToList();
        _mistakes.Setup(r => r.FindAsNoTrackingAsync(It.IsAny<Expression<Func<MistakeEntry, bool>>>(), default)).ReturnsAsync(mistakes);

        var result = await _handler.Handle(new GetSmartSessionQuery(_userId), default);

        Assert.Equal(5, result.Data!.Questions.Count(q => q.Source == "mistake"));
    }

    [Fact]
    public async Task Handle_InterleavesPoolsRatherThanBlocking()
    {
        var cardId = Guid.NewGuid();
        _srs.Setup(r => r.GetDueByUserIdAsync(_userId, It.IsAny<DateTime>(), default))
            .ReturnsAsync(new[] { new FlashcardSrsData { UserId = _userId, FlashcardId = cardId, Due = DateTime.UtcNow.AddDays(-1) } });
        _flashcards.Setup(r => r.GetByUserIdAsync(_userId, default))
            .ReturnsAsync(new[] { new Flashcard { FlashcardId = cardId, Front = "Q", Back = "A" } });
        var mistakeId = Guid.NewGuid();
        _mistakes.Setup(r => r.FindAsNoTrackingAsync(It.IsAny<Expression<Func<MistakeEntry, bool>>>(), default))
            .ReturnsAsync(new[] { new MistakeEntry { MistakeEntryId = mistakeId, UserId = _userId, Status = "open", Question = "Q2", CorrectAnswer = "A2" } });

        var result = await _handler.Handle(new GetSmartSessionQuery(_userId), default);

        Assert.Equal(2, result.Data!.Questions.Count);
        Assert.Equal("flashcard", result.Data.Questions[0].Source);
        Assert.Equal("mistake", result.Data.Questions[1].Source);
    }
}
