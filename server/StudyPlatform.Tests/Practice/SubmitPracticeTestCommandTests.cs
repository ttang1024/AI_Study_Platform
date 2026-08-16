using System.Linq.Expressions;
using MediatR;
using Moq;
using StudyPlatform.Application.Analytics.Queries;
using StudyPlatform.Application.Common;
using StudyPlatform.Application.Flashcards.Commands;
using StudyPlatform.Application.Practice.Queries;
using StudyPlatform.Application.Services;
using StudyPlatform.Domain.Entities;
using StudyPlatform.Domain.Interfaces;
using Xunit;

namespace StudyPlatform.Tests.Practice;

public class SubmitPracticeTestCommandHandlerTests
{
    private readonly Mock<IUnitOfWork> _uow = new();
    private readonly Mock<IGlossaryMasteredRepository> _mastered = new();
    private readonly Mock<IWorkedProblemMasteredRepository> _problemsMastered = new();
    private readonly Mock<IMistakeEntryRepository> _mistakes = new();
    private readonly Mock<IMediator> _mediator = new();
    private readonly Mock<IAppCache> _cache = new();
    private readonly SubmitPracticeTestCommandHandler _handler;
    private readonly Guid _userId = Guid.NewGuid();

    public SubmitPracticeTestCommandHandlerTests()
    {
        _uow.Setup(u => u.GlossaryMastered).Returns(_mastered.Object);
        _uow.Setup(u => u.WorkedProblemMastered).Returns(_problemsMastered.Object);
        _uow.Setup(u => u.MistakeEntries).Returns(_mistakes.Object);
        _uow.Setup(u => u.SaveChangesAsync(default)).ReturnsAsync(1);
        _mastered.Setup(r => r.GetMasteredTermIdsByUserAsync(_userId, default)).ReturnsAsync(Array.Empty<Guid>());
        _problemsMastered.Setup(r => r.GetMasteredProblemIdsByUserAsync(_userId, default)).ReturnsAsync(Array.Empty<Guid>());
        _mistakes.Setup(r => r.FindAsync(It.IsAny<Expression<Func<MistakeEntry, bool>>>(), default)).ReturnsAsync(Array.Empty<MistakeEntry>());
        _cache.Setup(c => c.RemoveAsync(It.IsAny<string>(), default)).Returns(Task.CompletedTask);
        _handler = new SubmitPracticeTestCommandHandler(_uow.Object, _mediator.Object, _cache.Object);
    }

    [Fact]
    public async Task Handle_EmptyResults_ReturnsZeroAccuracy()
    {
        var result = await _handler.Handle(new SubmitPracticeTestCommand(_userId, Array.Empty<PracticeResultItem>()), default);

        Assert.True(result.IsSuccess);
        Assert.Equal(0, result.Data!.Total);
        Assert.Equal(0, result.Data.AccuracyPercent);
    }

    [Fact]
    public async Task Handle_QuizResult_SendsRecordQuizAttemptCommand()
    {
        var quizId = Guid.NewGuid();
        var results = new[] { new PracticeResultItem("quiz", quizId, true) };

        await _handler.Handle(new SubmitPracticeTestCommand(_userId, results), default);

        _mediator.Verify(m => m.Send(
            It.Is<RecordQuizAttemptCommand>(c => c.UserId == _userId && c.QuizId == quizId && c.IsCorrect),
            It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task Handle_CorrectFlashcard_SendsGoodRating()
    {
        var cardId = Guid.NewGuid();
        var results = new[] { new PracticeResultItem("flashcard", cardId, true) };

        await _handler.Handle(new SubmitPracticeTestCommand(_userId, results), default);

        _mediator.Verify(m => m.Send(
            It.Is<ReviewFlashcardCommand>(c => c.FlashcardId == cardId && c.Rating == 3),
            It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task Handle_IncorrectFlashcard_SendsAgainRating()
    {
        var cardId = Guid.NewGuid();
        var results = new[] { new PracticeResultItem("flashcard", cardId, false) };

        await _handler.Handle(new SubmitPracticeTestCommand(_userId, results), default);

        _mediator.Verify(m => m.Send(
            It.Is<ReviewFlashcardCommand>(c => c.FlashcardId == cardId && c.Rating == 1),
            It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task Handle_CorrectGlossaryTerm_AddsMasteredEntry()
    {
        var termId = Guid.NewGuid();
        var results = new[] { new PracticeResultItem("glossary", termId, true) };

        await _handler.Handle(new SubmitPracticeTestCommand(_userId, results), default);

        _mastered.Verify(r => r.AddAsync(It.Is<GlossaryMastered>(g => g.GlossaryTermId == termId && g.UserId == _userId), default), Times.Once);
    }

    [Fact]
    public async Task Handle_AlreadyMasteredGlossaryTerm_DoesNotDuplicate()
    {
        var termId = Guid.NewGuid();
        _mastered.Setup(r => r.GetMasteredTermIdsByUserAsync(_userId, default)).ReturnsAsync(new[] { termId });
        var results = new[] { new PracticeResultItem("glossary", termId, true) };

        await _handler.Handle(new SubmitPracticeTestCommand(_userId, results), default);

        _mastered.Verify(r => r.AddAsync(It.IsAny<GlossaryMastered>(), default), Times.Never);
    }

    [Fact]
    public async Task Handle_IncorrectGlossaryTerm_DoesNotMarkMastered()
    {
        var termId = Guid.NewGuid();
        var results = new[] { new PracticeResultItem("glossary", termId, false) };

        await _handler.Handle(new SubmitPracticeTestCommand(_userId, results), default);

        _mastered.Verify(r => r.AddAsync(It.IsAny<GlossaryMastered>(), default), Times.Never);
    }

    [Fact]
    public async Task Handle_CorrectProblem_AddsMasteredEntry()
    {
        var problemId = Guid.NewGuid();
        var results = new[] { new PracticeResultItem("problem", problemId, true) };

        await _handler.Handle(new SubmitPracticeTestCommand(_userId, results), default);

        _problemsMastered.Verify(r => r.AddAsync(It.Is<WorkedProblemMastered>(p => p.WorkedProblemId == problemId), default), Times.Once);
    }

    [Fact]
    public async Task Handle_CorrectMistake_ResolvesIt()
    {
        var mistakeId = Guid.NewGuid();
        var mistake = new MistakeEntry { MistakeEntryId = mistakeId, UserId = _userId, Status = "open" };
        _mistakes.Setup(r => r.FindAsync(It.IsAny<Expression<Func<MistakeEntry, bool>>>(), default)).ReturnsAsync(new[] { mistake });
        var results = new[] { new PracticeResultItem("mistake", mistakeId, true) };

        await _handler.Handle(new SubmitPracticeTestCommand(_userId, results), default);

        Assert.Equal("resolved", mistake.Status);
        Assert.NotNull(mistake.ResolvedAt);
    }

    [Fact]
    public async Task Handle_IncorrectMistake_BumpsTimesMissed()
    {
        var mistakeId = Guid.NewGuid();
        var mistake = new MistakeEntry { MistakeEntryId = mistakeId, UserId = _userId, Status = "open", TimesMissed = 2 };
        _mistakes.Setup(r => r.FindAsync(It.IsAny<Expression<Func<MistakeEntry, bool>>>(), default)).ReturnsAsync(new[] { mistake });
        var results = new[] { new PracticeResultItem("mistake", mistakeId, false) };

        await _handler.Handle(new SubmitPracticeTestCommand(_userId, results), default);

        Assert.Equal(3, mistake.TimesMissed);
        Assert.Equal("open", mistake.Status);
    }

    [Fact]
    public async Task Handle_MistakeNotFound_SkipsSilently()
    {
        var results = new[] { new PracticeResultItem("mistake", Guid.NewGuid(), true) };

        var result = await _handler.Handle(new SubmitPracticeTestCommand(_userId, results), default);

        Assert.True(result.IsSuccess);
    }

    [Fact]
    public async Task Handle_ComputesAccuracyRoundedToOneDecimal()
    {
        var results = new[]
        {
            new PracticeResultItem("quiz", Guid.NewGuid(), true),
            new PracticeResultItem("quiz", Guid.NewGuid(), true),
            new PracticeResultItem("quiz", Guid.NewGuid(), false),
        };

        var result = await _handler.Handle(new SubmitPracticeTestCommand(_userId, results), default);

        Assert.Equal(3, result.Data!.Total);
        Assert.Equal(2, result.Data.Correct);
        Assert.Equal(66.7, result.Data.AccuracyPercent);
    }

    [Fact]
    public async Task Handle_ClearsCachedDashboardAndRecommendations()
    {
        var results = new[] { new PracticeResultItem("quiz", Guid.NewGuid(), true) };

        await _handler.Handle(new SubmitPracticeTestCommand(_userId, results), default);

        _cache.Verify(c => c.RemoveAsync(It.Is<string>(k => k.Contains("dashboard") || k.Contains(_userId.ToString())), default), Times.AtLeast(2));
    }
}
