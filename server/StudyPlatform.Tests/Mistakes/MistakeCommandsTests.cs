using System.Linq.Expressions;
using Moq;
using StudyPlatform.Application.Mistakes;
using StudyPlatform.Application.Services;
using StudyPlatform.Domain.Entities;
using StudyPlatform.Domain.Interfaces;
using Xunit;

namespace StudyPlatform.Tests.Mistakes;

public class SetMistakeStatusCommandHandlerTests
{
    private readonly Mock<IUnitOfWork> _uow = new();
    private readonly Mock<IMistakeEntryRepository> _mistakes = new();
    private readonly SetMistakeStatusCommandHandler _handler;
    private readonly Guid _userId = Guid.NewGuid();
    private readonly Guid _mistakeId = Guid.NewGuid();

    public SetMistakeStatusCommandHandlerTests()
    {
        _uow.Setup(u => u.MistakeEntries).Returns(_mistakes.Object);
        _handler = new SetMistakeStatusCommandHandler(_uow.Object);
    }

    [Theory]
    [InlineData("closed")]
    [InlineData("")]
    [InlineData("Open")]
    public async Task Handle_InvalidStatus_ReturnsFailure(string status)
    {
        var result = await _handler.Handle(new SetMistakeStatusCommand(_mistakeId, _userId, status), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("INVALID_STATUS", result.ErrorCode);
    }

    [Fact]
    public async Task Handle_MistakeNotFound_ReturnsFailure()
    {
        _mistakes.Setup(r => r.FirstOrDefaultAsync(It.IsAny<Expression<Func<MistakeEntry, bool>>>(), default))
            .ReturnsAsync((MistakeEntry?)null);

        var result = await _handler.Handle(new SetMistakeStatusCommand(_mistakeId, _userId, "resolved"), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("MISTAKE_NOT_FOUND", result.ErrorCode);
    }

    [Fact]
    public async Task Handle_ResolvedStatus_StampsResolvedAt()
    {
        var entry = new MistakeEntry { MistakeEntryId = _mistakeId, UserId = _userId, Status = "open" };
        _mistakes.Setup(r => r.FirstOrDefaultAsync(It.IsAny<Expression<Func<MistakeEntry, bool>>>(), default)).ReturnsAsync(entry);

        var result = await _handler.Handle(new SetMistakeStatusCommand(_mistakeId, _userId, "resolved"), default);

        Assert.True(result.IsSuccess);
        Assert.Equal("resolved", entry.Status);
        Assert.NotNull(entry.ResolvedAt);
    }

    [Fact]
    public async Task Handle_OpenStatus_ClearsResolvedAt()
    {
        var entry = new MistakeEntry { MistakeEntryId = _mistakeId, UserId = _userId, Status = "resolved", ResolvedAt = DateTime.UtcNow };
        _mistakes.Setup(r => r.FirstOrDefaultAsync(It.IsAny<Expression<Func<MistakeEntry, bool>>>(), default)).ReturnsAsync(entry);

        var result = await _handler.Handle(new SetMistakeStatusCommand(_mistakeId, _userId, "open"), default);

        Assert.True(result.IsSuccess);
        Assert.Null(entry.ResolvedAt);
    }
}

public class DeleteMistakeCommandHandlerTests
{
    private readonly Mock<IUnitOfWork> _uow = new();
    private readonly Mock<IMistakeEntryRepository> _mistakes = new();
    private readonly DeleteMistakeCommandHandler _handler;
    private readonly Guid _userId = Guid.NewGuid();
    private readonly Guid _mistakeId = Guid.NewGuid();

    public DeleteMistakeCommandHandlerTests()
    {
        _uow.Setup(u => u.MistakeEntries).Returns(_mistakes.Object);
        _handler = new DeleteMistakeCommandHandler(_uow.Object);
    }

    [Fact]
    public async Task Handle_NotFound_ReturnsFailure()
    {
        _mistakes.Setup(r => r.FirstOrDefaultAsync(It.IsAny<Expression<Func<MistakeEntry, bool>>>(), default))
            .ReturnsAsync((MistakeEntry?)null);

        var result = await _handler.Handle(new DeleteMistakeCommand(_mistakeId, _userId), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("MISTAKE_NOT_FOUND", result.ErrorCode);
    }

    [Fact]
    public async Task Handle_Found_RemovesAndReturnsTrue()
    {
        var entry = new MistakeEntry { MistakeEntryId = _mistakeId, UserId = _userId };
        _mistakes.Setup(r => r.FirstOrDefaultAsync(It.IsAny<Expression<Func<MistakeEntry, bool>>>(), default)).ReturnsAsync(entry);

        var result = await _handler.Handle(new DeleteMistakeCommand(_mistakeId, _userId), default);

        Assert.True(result.IsSuccess);
        Assert.True(result.Data);
        _mistakes.Verify(r => r.Remove(entry), Times.Once);
    }
}

public class GenerateMistakeVariantsCommandHandlerTests
{
    private readonly Mock<IUnitOfWork> _uow = new();
    private readonly Mock<IMistakeEntryRepository> _mistakes = new();
    private readonly Mock<IAiService> _aiService = new();
    private readonly GenerateMistakeVariantsCommandHandler _handler;
    private readonly Guid _userId = Guid.NewGuid();
    private readonly Guid _mistakeId = Guid.NewGuid();

    public GenerateMistakeVariantsCommandHandlerTests()
    {
        _uow.Setup(u => u.MistakeEntries).Returns(_mistakes.Object);
        _handler = new GenerateMistakeVariantsCommandHandler(_uow.Object, _aiService.Object);
    }

    private MistakeEntry MakeEntry() => new()
    {
        MistakeEntryId = _mistakeId,
        UserId = _userId,
        Question = "What is 2+2?",
        CorrectAnswer = "4",
        UserAnswer = "5",
        Explanation = "Basic arithmetic.",
    };

    [Fact]
    public async Task Handle_MistakeNotFound_ReturnsFailure()
    {
        _mistakes.Setup(r => r.FirstOrDefaultAsync(It.IsAny<Expression<Func<MistakeEntry, bool>>>(), default))
            .ReturnsAsync((MistakeEntry?)null);

        var result = await _handler.Handle(new GenerateMistakeVariantsCommand(_mistakeId, _userId), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("MISTAKE_NOT_FOUND", result.ErrorCode);
    }

    [Fact]
    public async Task Handle_MalformedAiJson_ReturnsParseError()
    {
        _mistakes.Setup(r => r.FirstOrDefaultAsync(It.IsAny<Expression<Func<MistakeEntry, bool>>>(), default)).ReturnsAsync(MakeEntry());
        _aiService.Setup(a => a.GenerateQuizAsync(It.IsAny<string>(), "medium", default)).ReturnsAsync("{not valid json");

        var result = await _handler.Handle(new GenerateMistakeVariantsCommand(_mistakeId, _userId), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("AI_PARSE_ERROR", result.ErrorCode);
    }

    [Fact]
    public async Task Handle_EmptyVariantsArray_ReturnsAiEmpty()
    {
        _mistakes.Setup(r => r.FirstOrDefaultAsync(It.IsAny<Expression<Func<MistakeEntry, bool>>>(), default)).ReturnsAsync(MakeEntry());
        _aiService.Setup(a => a.GenerateQuizAsync(It.IsAny<string>(), "medium", default)).ReturnsAsync("[]");

        var result = await _handler.Handle(new GenerateMistakeVariantsCommand(_mistakeId, _userId), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("AI_EMPTY", result.ErrorCode);
    }

    [Fact]
    public async Task Handle_ValidVariants_ReturnsThemCappedAtThree()
    {
        _mistakes.Setup(r => r.FirstOrDefaultAsync(It.IsAny<Expression<Func<MistakeEntry, bool>>>(), default)).ReturnsAsync(MakeEntry());
        var json = """
            [
              {"question":"Q1","options":["A","B"],"correctAnswer":"A","explanation":"E1"},
              {"question":"Q2","options":["A","B"],"correctAnswer":"A","explanation":"E2"},
              {"question":"Q3","options":["A","B"],"correctAnswer":"A","explanation":"E3"},
              {"question":"Q4","options":["A","B"],"correctAnswer":"A","explanation":"E4"}
            ]
            """;
        _aiService.Setup(a => a.GenerateQuizAsync(It.IsAny<string>(), "medium", default)).ReturnsAsync(json);

        var result = await _handler.Handle(new GenerateMistakeVariantsCommand(_mistakeId, _userId), default);

        Assert.True(result.IsSuccess);
        Assert.Equal(3, result.Data!.Count);
    }
}
