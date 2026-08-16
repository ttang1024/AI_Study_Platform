using System.Text.Json;
using Moq;
using StudyPlatform.Application.Practice;
using StudyPlatform.Application.Services;
using Xunit;

namespace StudyPlatform.Tests.Practice;

public class GradeHandwrittenWorkCommandHandlerTests
{
    private readonly Mock<IAiService> _ai = new();
    private readonly GradeHandwrittenWorkCommandHandler _handler;
    private readonly Guid _userId = Guid.NewGuid();

    public GradeHandwrittenWorkCommandHandlerTests()
    {
        _handler = new GradeHandwrittenWorkCommandHandler(_ai.Object);
    }

    private static (byte[] Data, string MimeType)[] OnePage() => new[] { (new byte[] { 1, 2, 3 }, "image/png") };

    [Fact]
    public async Task Handle_NoPages_ReturnsFailure()
    {
        var result = await _handler.Handle(new GradeHandwrittenWorkCommand(_userId, Array.Empty<(byte[], string)>(), null), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("NO_PAGES", result.ErrorCode);
    }

    [Fact]
    public async Task Handle_MalformedJson_ReturnsParseError()
    {
        _ai.Setup(a => a.GradeHandwrittenWorkAsync(It.IsAny<IReadOnlyList<(byte[], string)>>(), It.IsAny<string?>(), default))
            .ReturnsAsync("{not valid json");

        var result = await _handler.Handle(new GradeHandwrittenWorkCommand(_userId, OnePage(), null), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("PARSE_ERROR", result.ErrorCode);
    }

    [Fact]
    public async Task Handle_NullOrBlankSummary_ReturnsUnreadable()
    {
        _ai.Setup(a => a.GradeHandwrittenWorkAsync(It.IsAny<IReadOnlyList<(byte[], string)>>(), It.IsAny<string?>(), default))
            .ReturnsAsync(JsonSerializer.Serialize(new { summary = "" }));

        var result = await _handler.Handle(new GradeHandwrittenWorkCommand(_userId, OnePage(), null), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("UNREADABLE", result.ErrorCode);
    }

    [Fact]
    public async Task Handle_ValidResponse_MapsAllFields()
    {
        var json = JsonSerializer.Serialize(new
        {
            problem = "2 + 2",
            transcription = "2 + 2 = 4",
            isCorrect = true,
            steps = new[] { new { step = 1, text = "2+2", verdict = "correct", comment = "good" } },
            summary = "Correct work",
            concepts = new[] { "addition" },
        });
        _ai.Setup(a => a.GradeHandwrittenWorkAsync(It.IsAny<IReadOnlyList<(byte[], string)>>(), It.IsAny<string?>(), default))
            .ReturnsAsync(json);

        var result = await _handler.Handle(new GradeHandwrittenWorkCommand(_userId, OnePage(), "2 + 2"), default);

        Assert.True(result.IsSuccess);
        Assert.Equal("2 + 2", result.Data!.Problem);
        Assert.True(result.Data.IsCorrect);
        Assert.Single(result.Data.Steps);
        Assert.Equal("addition", result.Data.Concepts.Single());
    }

    [Fact]
    public async Task Handle_StepIndexFallsBackToPositionWhenStepIsZeroOrNegative()
    {
        var json = JsonSerializer.Serialize(new
        {
            summary = "ok",
            steps = new[]
            {
                new { step = 0, text = "first", verdict = "correct", comment = "" },
                new { step = 0, text = "second", verdict = "correct", comment = "" },
            },
        });
        _ai.Setup(a => a.GradeHandwrittenWorkAsync(It.IsAny<IReadOnlyList<(byte[], string)>>(), It.IsAny<string?>(), default))
            .ReturnsAsync(json);

        var result = await _handler.Handle(new GradeHandwrittenWorkCommand(_userId, OnePage(), null), default);

        Assert.Equal(1, result.Data!.Steps[0].Step);
        Assert.Equal(2, result.Data.Steps[1].Step);
    }

    [Theory]
    [InlineData("Correct", "correct")]
    [InlineData("INCORRECT", "incorrect")]
    [InlineData("Consequent", "consequent")]
    [InlineData("garbage", "unclear")]
    [InlineData(null, "unclear")]
    public async Task Handle_NormalizesVerdictCaseInsensitively(string? rawVerdict, string expected)
    {
        var json = JsonSerializer.Serialize(new
        {
            summary = "ok",
            steps = new[] { new { step = 1, text = "x", verdict = rawVerdict, comment = "" } },
        });
        _ai.Setup(a => a.GradeHandwrittenWorkAsync(It.IsAny<IReadOnlyList<(byte[], string)>>(), It.IsAny<string?>(), default))
            .ReturnsAsync(json);

        var result = await _handler.Handle(new GradeHandwrittenWorkCommand(_userId, OnePage(), null), default);

        Assert.Equal(expected, result.Data!.Steps[0].Verdict);
    }

    [Fact]
    public async Task Handle_FirstErrorStep_TrustsStepsOverModelClaim_WhenAnIncorrectStepExists()
    {
        var json = JsonSerializer.Serialize(new
        {
            summary = "ok",
            firstErrorStep = 5, // model claims step 5, but step 2 is what's actually marked incorrect
            steps = new[]
            {
                new { step = 1, text = "a", verdict = "correct", comment = "" },
                new { step = 2, text = "b", verdict = "incorrect", comment = "" },
                new { step = 3, text = "c", verdict = "consequent", comment = "" },
            },
        });
        _ai.Setup(a => a.GradeHandwrittenWorkAsync(It.IsAny<IReadOnlyList<(byte[], string)>>(), It.IsAny<string?>(), default))
            .ReturnsAsync(json);

        var result = await _handler.Handle(new GradeHandwrittenWorkCommand(_userId, OnePage(), null), default);

        Assert.Equal(2, result.Data!.FirstErrorStep);
    }

    [Fact]
    public async Task Handle_FirstErrorStep_NoIncorrectStepsButHasSteps_DropsSpuriousClaim()
    {
        var json = JsonSerializer.Serialize(new
        {
            summary = "ok",
            firstErrorStep = 3,
            steps = new[] { new { step = 1, text = "a", verdict = "correct", comment = "" } },
        });
        _ai.Setup(a => a.GradeHandwrittenWorkAsync(It.IsAny<IReadOnlyList<(byte[], string)>>(), It.IsAny<string?>(), default))
            .ReturnsAsync(json);

        var result = await _handler.Handle(new GradeHandwrittenWorkCommand(_userId, OnePage(), null), default);

        Assert.Null(result.Data!.FirstErrorStep);
    }

    [Fact]
    public async Task Handle_FirstErrorStep_NoStepsAtAll_KeepsModelClaim()
    {
        var json = JsonSerializer.Serialize(new { summary = "ok", firstErrorStep = 3, steps = Array.Empty<object>() });
        _ai.Setup(a => a.GradeHandwrittenWorkAsync(It.IsAny<IReadOnlyList<(byte[], string)>>(), It.IsAny<string?>(), default))
            .ReturnsAsync(json);

        var result = await _handler.Handle(new GradeHandwrittenWorkCommand(_userId, OnePage(), null), default);

        Assert.Equal(3, result.Data!.FirstErrorStep);
    }
}
