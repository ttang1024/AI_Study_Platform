using System.Linq.Expressions;
using Moq;
using StudyPlatform.Application.Flashcards.Commands;
using StudyPlatform.Domain.Entities;
using StudyPlatform.Domain.Interfaces;
using Xunit;

namespace StudyPlatform.Tests.Flashcards;

public class ImportFlashcardsCommandHandlerTests
{
    private readonly Mock<IUnitOfWork> _uow = new();
    private readonly Mock<IFlashcardRepository> _flashcards = new();
    private readonly ImportFlashcardsCommandHandler _handler;
    private readonly Guid _userId = Guid.NewGuid();

    public ImportFlashcardsCommandHandlerTests()
    {
        _uow.Setup(u => u.Flashcards).Returns(_flashcards.Object);
        _uow.Setup(u => u.SaveChangesAsync(default)).ReturnsAsync(1);
        _flashcards.Setup(r => r.FindAsync(It.IsAny<Expression<Func<Flashcard, bool>>>(), default)).ReturnsAsync(Array.Empty<Flashcard>());
        _flashcards.Setup(r => r.AddRangeAsync(It.IsAny<IEnumerable<Flashcard>>(), default)).Returns(Task.CompletedTask);
        _handler = new ImportFlashcardsCommandHandler(_uow.Object);
    }

    [Fact]
    public async Task Handle_NoRows_ReturnsFailure()
    {
        var result = await _handler.Handle(new ImportFlashcardsCommand(_userId, Array.Empty<ImportFlashcardRow>()), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("NO_ROWS", result.ErrorCode);
    }

    [Fact]
    public async Task Handle_TooManyRows_ReturnsFailure()
    {
        var rows = Enumerable.Range(0, 2001).Select(i => new ImportFlashcardRow($"F{i}", $"B{i}", null, null)).ToList();

        var result = await _handler.Handle(new ImportFlashcardsCommand(_userId, rows), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("TOO_MANY_ROWS", result.ErrorCode);
    }

    [Fact]
    public async Task Handle_RowWithBlankFrontOrBack_IsSkipped()
    {
        var rows = new[]
        {
            new ImportFlashcardRow("  ", "Back", null, null),
            new ImportFlashcardRow("Front", "  ", null, null),
        };

        var result = await _handler.Handle(new ImportFlashcardsCommand(_userId, rows), default);

        Assert.Equal(0, result.Data!.ImportedCount);
        Assert.Equal(2, result.Data.SkippedCount);
    }

    [Fact]
    public async Task Handle_DuplicateOfExistingFront_IsSkipped()
    {
        _flashcards.Setup(r => r.FindAsync(It.IsAny<Expression<Func<Flashcard, bool>>>(), default))
            .ReturnsAsync(new[] { new Flashcard { FlashcardId = Guid.NewGuid(), Front = "Existing", Back = "B" } });

        var result = await _handler.Handle(new ImportFlashcardsCommand(_userId, new[] { new ImportFlashcardRow("existing", "New back", null, null) }), default);

        Assert.Equal(0, result.Data!.ImportedCount);
        Assert.Equal(1, result.Data.SkippedCount);
    }

    [Fact]
    public async Task Handle_DuplicateWithinSameBatch_IsSkipped()
    {
        var rows = new[]
        {
            new ImportFlashcardRow("Same Front", "Back 1", null, null),
            new ImportFlashcardRow("same front", "Back 2", null, null),
        };

        var result = await _handler.Handle(new ImportFlashcardsCommand(_userId, rows), default);

        Assert.Equal(1, result.Data!.ImportedCount);
        Assert.Equal(1, result.Data.SkippedCount);
    }

    [Theory]
    [InlineData("cloze", "cloze")]
    [InlineData("chart", "chart")]
    [InlineData("basic", "basic")]
    [InlineData("unknown", "basic")]
    [InlineData(null, "basic")]
    public async Task Handle_NormalizesCardType(string? input, string expected)
    {
        List<Flashcard>? captured = null;
        _flashcards.Setup(r => r.AddRangeAsync(It.IsAny<IEnumerable<Flashcard>>(), default))
            .Callback<IEnumerable<Flashcard>, CancellationToken>((cards, _) => captured = cards.ToList())
            .Returns(Task.CompletedTask);

        await _handler.Handle(new ImportFlashcardsCommand(_userId, new[] { new ImportFlashcardRow("F", "B", input, null) }), default);

        Assert.Equal(expected, captured![0].CardType);
    }

    [Fact]
    public async Task Handle_TagsCappedAt10AndBlanksFiltered()
    {
        var tags = Enumerable.Range(0, 15).Select(i => $"tag{i}").Append("   ").ToList();
        List<Flashcard>? captured = null;
        _flashcards.Setup(r => r.AddRangeAsync(It.IsAny<IEnumerable<Flashcard>>(), default))
            .Callback<IEnumerable<Flashcard>, CancellationToken>((cards, _) => captured = cards.ToList())
            .Returns(Task.CompletedTask);

        await _handler.Handle(new ImportFlashcardsCommand(_userId, new[] { new ImportFlashcardRow("F", "B", null, tags) }), default);

        Assert.Equal(10, captured![0].Tags.Count);
        Assert.DoesNotContain("   ", captured[0].Tags);
    }

    [Fact]
    public async Task Handle_NoRowsSurvive_DoesNotCallAddRangeOrSave()
    {
        var rows = new[] { new ImportFlashcardRow("", "", null, null) };

        await _handler.Handle(new ImportFlashcardsCommand(_userId, rows), default);

        _flashcards.Verify(r => r.AddRangeAsync(It.IsAny<IEnumerable<Flashcard>>(), default), Times.Never);
        _uow.Verify(u => u.SaveChangesAsync(default), Times.Never);
    }

    [Fact]
    public async Task Handle_ValidRows_ImportsSuccessfully()
    {
        var rows = new[]
        {
            new ImportFlashcardRow("Q1", "A1", null, null),
            new ImportFlashcardRow("Q2", "A2", null, null),
        };

        var result = await _handler.Handle(new ImportFlashcardsCommand(_userId, rows), default);

        Assert.True(result.IsSuccess);
        Assert.Equal(2, result.Data!.ImportedCount);
        Assert.Equal(0, result.Data.SkippedCount);
    }
}
