using System.Text.Json;
using Moq;
using StudyPlatform.Application.Services;
using StudyPlatform.Application.WorkedProblems.Commands;
using StudyPlatform.Domain.Entities;
using StudyPlatform.Domain.Interfaces;
using Xunit;

namespace StudyPlatform.Tests.WorkedProblems;

public class GenerateWorkedProblemsCommandHandlerTests
{
    private readonly Mock<IUnitOfWork> _uow = new();
    private readonly Mock<IDocumentRepository> _documents = new();
    private readonly Mock<IVideoRepository> _videos = new();
    private readonly Mock<IWorkedProblemRepository> _problems = new();
    private readonly Mock<IAiService> _ai = new();
    private readonly Mock<IDocumentTextExtractor> _extractor = new();
    private readonly GenerateWorkedProblemsCommandHandler _handler;
    private readonly Guid _userId = Guid.NewGuid();
    private readonly Guid _documentId = Guid.NewGuid();

    public GenerateWorkedProblemsCommandHandlerTests()
    {
        _uow.Setup(u => u.Documents).Returns(_documents.Object);
        _uow.Setup(u => u.Videos).Returns(_videos.Object);
        _uow.Setup(u => u.WorkedProblems).Returns(_problems.Object);
        _uow.Setup(u => u.SaveChangesAsync(default)).ReturnsAsync(1);
        _problems.Setup(r => r.AddRangeAsync(It.IsAny<IEnumerable<WorkedProblem>>(), default)).Returns(Task.CompletedTask);
        _handler = new GenerateWorkedProblemsCommandHandler(_uow.Object, _ai.Object, _extractor.Object);
    }

    private static string OneProblemJson() => JsonSerializer.Serialize(new[]
    {
        new { Problem = "Solve x+1=2", Steps = new[] { new { StepNumber = 1, Description = "Subtract 1", Formula = (string?)null } }, Answer = "x=1", Topic = "Algebra" },
    });

    [Fact]
    public async Task Handle_DocumentNotOwned_ReturnsFailure()
    {
        _documents.Setup(r => r.GetByIdAsync(_documentId, default)).ReturnsAsync(new Document { DocumentId = _documentId, UserId = Guid.NewGuid() });

        var result = await _handler.Handle(new GenerateWorkedProblemsCommand(_userId, _documentId, null, "medium", 3), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("DOCUMENT_NOT_FOUND", result.ErrorCode);
    }

    [Fact]
    public async Task Handle_VideoNotFound_ReturnsFailure()
    {
        var videoId = Guid.NewGuid();
        _videos.Setup(r => r.GetByIdForUserAsync(videoId, _userId, default)).ReturnsAsync((Video?)null);

        var result = await _handler.Handle(new GenerateWorkedProblemsCommand(_userId, null, videoId, "medium", 3), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("VIDEO_NOT_FOUND", result.ErrorCode);
    }

    [Fact]
    public async Task Handle_NeitherDocumentNorVideo_ReturnsNoContent()
    {
        var result = await _handler.Handle(new GenerateWorkedProblemsCommand(_userId, null, null, "medium", 3), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("NO_CONTENT", result.ErrorCode);
    }

    [Fact]
    public async Task Handle_VideoWithBlankTranscriptAndSummary_FallsBackToTitleThenSucceeds()
    {
        var videoId = Guid.NewGuid();
        _videos.Setup(r => r.GetByIdForUserAsync(videoId, _userId, default))
            .ReturnsAsync(new Video { VideoId = videoId, UserId = _userId, Title = "Algebra Basics", Transcript = null, Summary = null });
        _ai.Setup(a => a.GenerateWorkedProblemsAsync("Algebra Basics", "medium", 3, default)).ReturnsAsync(OneProblemJson());

        var result = await _handler.Handle(new GenerateWorkedProblemsCommand(_userId, null, videoId, "medium", 3), default);

        Assert.True(result.IsSuccess);
    }

    [Fact]
    public async Task Handle_ValidDocument_GeneratesAndSavesProblems()
    {
        _documents.Setup(r => r.GetByIdAsync(_documentId, default)).ReturnsAsync(new Document { DocumentId = _documentId, UserId = _userId, BlobUrl = "blob", ContentType = "text/plain" });
        _extractor.Setup(e => e.ExtractTextAsync("blob", "text/plain", default)).ReturnsAsync("Solve for x.");
        _ai.Setup(a => a.GenerateWorkedProblemsAsync("Solve for x.", "medium", 3, default)).ReturnsAsync(OneProblemJson());

        var result = await _handler.Handle(new GenerateWorkedProblemsCommand(_userId, _documentId, null, "medium", 3), default);

        Assert.True(result.IsSuccess);
        var dto = Assert.Single(result.Data!);
        Assert.Equal("Solve x+1=2", dto.ProblemText);
        Assert.Equal("Algebra", dto.Topic);
        Assert.Single(dto.Steps);
        _problems.Verify(r => r.AddRangeAsync(It.IsAny<IEnumerable<WorkedProblem>>(), default), Times.Once);
    }

    [Fact]
    public async Task Handle_MalformedAiJson_ProducesEmptyResultWithoutThrowing()
    {
        _documents.Setup(r => r.GetByIdAsync(_documentId, default)).ReturnsAsync(new Document { DocumentId = _documentId, UserId = _userId, BlobUrl = "b", ContentType = "text/plain" });
        _extractor.Setup(e => e.ExtractTextAsync("b", "text/plain", default)).ReturnsAsync("content");
        _ai.Setup(a => a.GenerateWorkedProblemsAsync("content", "medium", 3, default)).ReturnsAsync("{not valid json");

        var result = await _handler.Handle(new GenerateWorkedProblemsCommand(_userId, _documentId, null, "medium", 3), default);

        Assert.True(result.IsSuccess);
        Assert.Empty(result.Data!);
    }
}

public class SubmitProblemAttemptCommandHandlerTests
{
    private readonly Mock<IUnitOfWork> _uow = new();
    private readonly Mock<IWorkedProblemRepository> _problems = new();
    private readonly Mock<IWorkedProblemAttemptRepository> _attempts = new();
    private readonly Mock<IAiService> _ai = new();
    private readonly SubmitProblemAttemptCommandHandler _handler;
    private readonly Guid _userId = Guid.NewGuid();
    private readonly Guid _problemId = Guid.NewGuid();

    public SubmitProblemAttemptCommandHandlerTests()
    {
        _uow.Setup(u => u.WorkedProblems).Returns(_problems.Object);
        _uow.Setup(u => u.WorkedProblemAttempts).Returns(_attempts.Object);
        _uow.Setup(u => u.SaveChangesAsync(default)).ReturnsAsync(1);
        _attempts.Setup(r => r.AddAsync(It.IsAny<WorkedProblemAttempt>(), default)).Returns(Task.CompletedTask);
        _handler = new SubmitProblemAttemptCommandHandler(_uow.Object, _ai.Object);
    }

    [Fact]
    public async Task Handle_ProblemNotOwned_ReturnsFailure()
    {
        _problems.Setup(r => r.GetByIdAsync(_problemId, default)).ReturnsAsync(new WorkedProblem { WorkedProblemId = _problemId, UserId = Guid.NewGuid() });

        var result = await _handler.Handle(new SubmitProblemAttemptCommand(_userId, _problemId, "x=1"), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("PROBLEM_NOT_FOUND", result.ErrorCode);
    }

    [Fact]
    public async Task Handle_ValidAttempt_SavesAiEvaluation()
    {
        _problems.Setup(r => r.GetByIdAsync(_problemId, default))
            .ReturnsAsync(new WorkedProblem { WorkedProblemId = _problemId, UserId = _userId, ProblemText = "x+1=2", FinalAnswer = "x=1" });
        var evalJson = JsonSerializer.Serialize(new { IsCorrect = true, Evaluation = "Correct!" });
        _ai.Setup(a => a.EvaluateProblemAttemptAsync("x+1=2", "x=1", "x=1", default)).ReturnsAsync(evalJson);

        var result = await _handler.Handle(new SubmitProblemAttemptCommand(_userId, _problemId, "x=1"), default);

        Assert.True(result.IsSuccess);
        Assert.True(result.Data!.IsCorrect);
        Assert.Equal("Correct!", result.Data.AiEvaluation);
    }

    [Fact]
    public async Task Handle_AiEvaluationThrows_StillSavesAttemptWithNullEvaluation()
    {
        _problems.Setup(r => r.GetByIdAsync(_problemId, default))
            .ReturnsAsync(new WorkedProblem { WorkedProblemId = _problemId, UserId = _userId, ProblemText = "x+1=2", FinalAnswer = "x=1" });
        _ai.Setup(a => a.EvaluateProblemAttemptAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(), default))
            .ThrowsAsync(new InvalidOperationException("AI down"));

        var result = await _handler.Handle(new SubmitProblemAttemptCommand(_userId, _problemId, "x=1"), default);

        Assert.True(result.IsSuccess);
        Assert.Null(result.Data!.IsCorrect);
        Assert.Null(result.Data.AiEvaluation);
        _attempts.Verify(r => r.AddAsync(It.IsAny<WorkedProblemAttempt>(), default), Times.Once);
    }

    [Fact]
    public async Task Handle_MalformedEvalJson_StillSavesAttemptWithNullEvaluation()
    {
        _problems.Setup(r => r.GetByIdAsync(_problemId, default))
            .ReturnsAsync(new WorkedProblem { WorkedProblemId = _problemId, UserId = _userId, ProblemText = "x+1=2", FinalAnswer = "x=1" });
        _ai.Setup(a => a.EvaluateProblemAttemptAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(), default))
            .ReturnsAsync("{bad json");

        var result = await _handler.Handle(new SubmitProblemAttemptCommand(_userId, _problemId, "x=1"), default);

        Assert.True(result.IsSuccess);
        Assert.Null(result.Data!.IsCorrect);
    }
}
