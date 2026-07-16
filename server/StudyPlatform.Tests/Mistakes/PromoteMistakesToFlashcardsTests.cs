using System.Linq.Expressions;
using Moq;
using StudyPlatform.Application.Mistakes;
using StudyPlatform.Domain.Entities;
using StudyPlatform.Domain.Interfaces;
using Xunit;

namespace StudyPlatform.Tests.Mistakes;

public class PromoteMistakesToFlashcardsTests
{
    private readonly Mock<IUnitOfWork> _uow = new();
    private readonly Mock<IMistakeEntryRepository> _mistakes = new();
    private readonly Mock<IFlashcardRepository> _flashcards = new();
    private readonly Mock<IFlashcardSrsDataRepository> _srs = new();

    private readonly Guid _userId = Guid.NewGuid();
    private readonly List<MistakeEntry> _store = new();
    private readonly List<Flashcard> _createdCards = new();
    private readonly List<FlashcardSrsData> _createdSrs = new();

    private readonly PromoteMistakesToFlashcardsCommandHandler _handler;

    public PromoteMistakesToFlashcardsTests()
    {
        _uow.Setup(u => u.MistakeEntries).Returns(_mistakes.Object);
        _uow.Setup(u => u.Flashcards).Returns(_flashcards.Object);
        _uow.Setup(u => u.FlashcardSrs).Returns(_srs.Object);
        _uow.Setup(u => u.SaveChangesAsync(default)).ReturnsAsync(1);

        _mistakes.Setup(r => r.FindAsync(It.IsAny<Expression<Func<MistakeEntry, bool>>>(), default))
            .ReturnsAsync((Expression<Func<MistakeEntry, bool>> predicate, CancellationToken _) =>
                _store.Where(predicate.Compile()).ToList());

        _flashcards.Setup(r => r.AddAsync(It.IsAny<Flashcard>(), default))
            .Callback<Flashcard, CancellationToken>((f, _) => _createdCards.Add(f))
            .Returns(Task.CompletedTask);

        _srs.Setup(r => r.AddAsync(It.IsAny<FlashcardSrsData>(), default))
            .Callback<FlashcardSrsData, CancellationToken>((s, _) => _createdSrs.Add(s))
            .Returns(Task.CompletedTask);

        _handler = new PromoteMistakesToFlashcardsCommandHandler(_uow.Object);
    }

    private MistakeEntry AddMistake(
        string question = "What is 2+2?",
        string answer = "4",
        string explanation = "Because arithmetic.",
        int timesMissed = 1,
        string status = "open",
        Guid? flashcardId = null)
    {
        var entry = new MistakeEntry
        {
            MistakeEntryId = Guid.NewGuid(),
            UserId = _userId,
            DocumentId = Guid.NewGuid(),
            SourceType = "document",
            Question = question,
            CorrectAnswer = answer,
            Explanation = explanation,
            TimesMissed = timesMissed,
            Status = status,
            FlashcardId = flashcardId,
        };
        _store.Add(entry);
        return entry;
    }

    [Fact]
    public async Task Handle_OpenMistake_CreatesCardCarryingTheQuestionAndExplanation()
    {
        var mistake = AddMistake(question: "Capital of France?", answer: "Paris", explanation: "It has been since 987.");

        var result = await _handler.Handle(new PromoteMistakesToFlashcardsCommand(_userId, []), default);

        Assert.True(result.IsSuccess);
        Assert.Equal(1, result.Data!.Created);

        var card = Assert.Single(_createdCards);
        Assert.Equal("Capital of France?", card.Front);
        Assert.Contains("Paris", card.Back);
        Assert.Contains("It has been since 987.", card.Back); // the explanation is most of the value
        Assert.Equal(mistake.DocumentId, card.DocumentId);
        Assert.Contains("mistake", card.Tags);
    }

    [Fact]
    public async Task Handle_AlwaysWritesAnSrsRowDueNow_OrTheCardWouldNeverSurface()
    {
        AddMistake();
        var before = DateTime.UtcNow;

        await _handler.Handle(new PromoteMistakesToFlashcardsCommand(_userId, []), default);

        // Every "due" path reads FlashcardSrsData; a card without a row is invisible to the review queue.
        var srs = Assert.Single(_createdSrs);
        Assert.Equal(_createdCards[0].FlashcardId, srs.FlashcardId);
        Assert.InRange(srs.Due, before, DateTime.UtcNow);
    }

    [Fact]
    public async Task Handle_RepeatedlyMissedQuestion_IsMarkedHard()
    {
        AddMistake(timesMissed: 3);

        await _handler.Handle(new PromoteMistakesToFlashcardsCommand(_userId, []), default);

        Assert.Equal("hard", _createdCards[0].Difficulty);
    }

    [Fact]
    public async Task Handle_MissedOnce_IsMarkedMedium()
    {
        AddMistake(timesMissed: 1);

        await _handler.Handle(new PromoteMistakesToFlashcardsCommand(_userId, []), default);

        Assert.Equal("medium", _createdCards[0].Difficulty);
    }

    [Fact]
    public async Task Handle_MistakeAlreadyPromoted_IsSkippedNotDuplicated()
    {
        AddMistake(flashcardId: Guid.NewGuid());

        var result = await _handler.Handle(new PromoteMistakesToFlashcardsCommand(_userId, []), default);

        Assert.True(result.IsSuccess);
        Assert.Equal(0, result.Data!.Created);
        Assert.Equal(1, result.Data.Skipped);
        Assert.Empty(_createdCards);
    }

    [Fact]
    public async Task Handle_RunTwice_SecondRunPromotesOnlyTheNewMistake()
    {
        var first = AddMistake(question: "First");
        await _handler.Handle(new PromoteMistakesToFlashcardsCommand(_userId, []), default);
        Assert.NotNull(first.FlashcardId); // the handler linked it, which is what makes this idempotent

        AddMistake(question: "Second");
        var result = await _handler.Handle(new PromoteMistakesToFlashcardsCommand(_userId, []), default);

        Assert.Equal(1, result.Data!.Created);
        Assert.Equal(1, result.Data.Skipped);
        Assert.Equal(2, _createdCards.Count);
        Assert.Equal("Second", _createdCards[1].Front);
    }

    [Fact]
    public async Task Handle_SelectedIdsOnly_LeavesOtherOpenMistakesAlone()
    {
        var chosen = AddMistake(question: "Chosen");
        AddMistake(question: "Ignored");

        var result = await _handler.Handle(
            new PromoteMistakesToFlashcardsCommand(_userId, [chosen.MistakeEntryId]), default);

        Assert.Equal(1, result.Data!.Created);
        Assert.Equal("Chosen", Assert.Single(_createdCards).Front);
    }

    [Fact]
    public async Task Handle_ResolvedMistakes_AreNotPromoted()
    {
        AddMistake(status: "resolved");

        var result = await _handler.Handle(new PromoteMistakesToFlashcardsCommand(_userId, []), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("NO_MISTAKES", result.ErrorCode);
        Assert.Empty(_createdCards);
    }

    [Fact]
    public async Task Handle_NoExplanation_BackIsJustTheAnswer()
    {
        AddMistake(answer: "42", explanation: "");

        await _handler.Handle(new PromoteMistakesToFlashcardsCommand(_userId, []), default);

        Assert.Equal("42", _createdCards[0].Back);
    }

    [Fact]
    public async Task Handle_NothingToPromote_Fails()
    {
        var result = await _handler.Handle(new PromoteMistakesToFlashcardsCommand(_userId, []), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("NO_MISTAKES", result.ErrorCode);
    }
}
