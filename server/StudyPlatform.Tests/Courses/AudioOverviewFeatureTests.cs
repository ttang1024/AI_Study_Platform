using System.Linq.Expressions;
using System.Text.Json;
using Microsoft.Extensions.Logging;
using Moq;
using StudyPlatform.Application.Courses;
using StudyPlatform.Application.Services;
using StudyPlatform.Domain.Entities;
using StudyPlatform.Domain.Interfaces;
using Xunit;

namespace StudyPlatform.Tests.Courses;

public class AudioOverviewMappingTests
{
    [Fact]
    public void ToDto_NoScriptJson_ScriptIsNull()
    {
        var overview = new CourseAudioOverview { Id = Guid.NewGuid(), CourseId = Guid.NewGuid(), Status = "pending", ScriptJson = null };

        var dto = overview.ToDto();

        Assert.Null(dto.Script);
    }

    [Fact]
    public void ToDto_ValidScriptJson_ParsesDialogueTurns()
    {
        var scriptJson = JsonSerializer.Serialize(new[] { new { Speaker = "A", Text = "Hello" } });
        var overview = new CourseAudioOverview { Id = Guid.NewGuid(), CourseId = Guid.NewGuid(), Status = "ready", ScriptJson = scriptJson };

        var dto = overview.ToDto();

        Assert.Single(dto.Script!);
        Assert.Equal("Hello", dto.Script![0].Text);
    }

    [Fact]
    public void ToDto_MalformedScriptJson_ScriptIsNullWithoutThrowing()
    {
        var overview = new CourseAudioOverview { Id = Guid.NewGuid(), CourseId = Guid.NewGuid(), Status = "ready", ScriptJson = "{bad" };

        var dto = overview.ToDto();

        Assert.Null(dto.Script);
    }
}

public class GetAudioOverviewQueryHandlerTests
{
    private readonly Mock<IUnitOfWork> _uow = new();
    private readonly Mock<ICourseAudioOverviewRepository> _overviews = new();
    private readonly GetAudioOverviewQueryHandler _handler;
    private readonly Guid _userId = Guid.NewGuid();
    private readonly Guid _courseId = Guid.NewGuid();

    public GetAudioOverviewQueryHandlerTests()
    {
        _uow.Setup(u => u.CourseAudioOverviews).Returns(_overviews.Object);
        _handler = new GetAudioOverviewQueryHandler(_uow.Object);
    }

    [Fact]
    public async Task Handle_NoOverviewExists_ReturnsSuccessWithNullData()
    {
        _overviews.Setup(r => r.GetLatestForCourseAsync(_userId, _courseId, default)).ReturnsAsync((CourseAudioOverview?)null);

        var result = await _handler.Handle(new GetAudioOverviewQuery(_userId, _courseId), default);

        Assert.True(result.IsSuccess);
        Assert.Null(result.Data);
    }

    [Fact]
    public async Task Handle_OverviewExists_ReturnsMappedDto()
    {
        _overviews.Setup(r => r.GetLatestForCourseAsync(_userId, _courseId, default))
            .ReturnsAsync(new CourseAudioOverview { Id = Guid.NewGuid(), UserId = _userId, CourseId = _courseId, Status = "ready" });

        var result = await _handler.Handle(new GetAudioOverviewQuery(_userId, _courseId), default);

        Assert.NotNull(result.Data);
        Assert.Equal("ready", result.Data!.Status);
    }
}

public class RequestAudioOverviewCommandHandlerTests
{
    private readonly Mock<IUnitOfWork> _uow = new();
    private readonly Mock<ICourseRepository> _courses = new();
    private readonly Mock<ICourseAudioOverviewRepository> _overviews = new();
    private readonly Mock<IDocumentRepository> _documents = new();
    private readonly Mock<IVideoRepository> _videos = new();
    private readonly RequestAudioOverviewCommandHandler _handler;
    private readonly Guid _userId = Guid.NewGuid();
    private readonly Guid _courseId = Guid.NewGuid();

    public RequestAudioOverviewCommandHandlerTests()
    {
        _uow.Setup(u => u.Courses).Returns(_courses.Object);
        _uow.Setup(u => u.CourseAudioOverviews).Returns(_overviews.Object);
        _uow.Setup(u => u.Documents).Returns(_documents.Object);
        _uow.Setup(u => u.Videos).Returns(_videos.Object);
        _uow.Setup(u => u.SaveChangesAsync(default)).ReturnsAsync(1);
        _courses.Setup(r => r.GetByIdAsync(_courseId, default)).ReturnsAsync(new Course { CourseId = _courseId, UserId = _userId });
        _overviews.Setup(r => r.GetLatestForCourseAsync(_userId, _courseId, default)).ReturnsAsync((CourseAudioOverview?)null);
        _overviews.Setup(r => r.AddAsync(It.IsAny<CourseAudioOverview>(), default)).Returns(Task.CompletedTask);
        _documents.Setup(r => r.CountAsync(It.IsAny<Expression<Func<Document, bool>>>(), default)).ReturnsAsync(1);
        _videos.Setup(r => r.CountAsync(It.IsAny<Expression<Func<Video, bool>>>(), default)).ReturnsAsync(0);
        _handler = new RequestAudioOverviewCommandHandler(_uow.Object);
    }

    [Fact]
    public async Task Handle_CourseNotOwned_ReturnsFailure()
    {
        _courses.Setup(r => r.GetByIdAsync(_courseId, default)).ReturnsAsync(new Course { CourseId = _courseId, UserId = Guid.NewGuid() });

        var result = await _handler.Handle(new RequestAudioOverviewCommand(_userId, _courseId), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("COURSE_NOT_FOUND", result.ErrorCode);
    }

    [Theory]
    [InlineData("pending")]
    [InlineData("processing")]
    public async Task Handle_GenerationAlreadyInProgress_ReturnsExistingOverview(string status)
    {
        var existing = new CourseAudioOverview { Id = Guid.NewGuid(), UserId = _userId, CourseId = _courseId, Status = status };
        _overviews.Setup(r => r.GetLatestForCourseAsync(_userId, _courseId, default)).ReturnsAsync(existing);

        var result = await _handler.Handle(new RequestAudioOverviewCommand(_userId, _courseId), default);

        Assert.True(result.IsSuccess);
        Assert.Equal(existing.Id, result.Data!.Id);
        _overviews.Verify(r => r.AddAsync(It.IsAny<CourseAudioOverview>(), default), Times.Never);
    }

    [Fact]
    public async Task Handle_NoSummarizedMaterials_ReturnsFailure()
    {
        _documents.Setup(r => r.CountAsync(It.IsAny<Expression<Func<Document, bool>>>(), default)).ReturnsAsync(0);
        _videos.Setup(r => r.CountAsync(It.IsAny<Expression<Func<Video, bool>>>(), default)).ReturnsAsync(0);

        var result = await _handler.Handle(new RequestAudioOverviewCommand(_userId, _courseId), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("NO_MATERIALS", result.ErrorCode);
    }

    [Fact]
    public async Task Handle_ValidRequest_QueuesPendingOverview()
    {
        var result = await _handler.Handle(new RequestAudioOverviewCommand(_userId, _courseId), default);

        Assert.True(result.IsSuccess);
        Assert.Equal("pending", result.Data!.Status);
        _overviews.Verify(r => r.AddAsync(It.IsAny<CourseAudioOverview>(), default), Times.Once);
    }

    [Fact]
    public async Task Handle_PreviousOverviewFailed_AllowsNewRequest()
    {
        _overviews.Setup(r => r.GetLatestForCourseAsync(_userId, _courseId, default))
            .ReturnsAsync(new CourseAudioOverview { Id = Guid.NewGuid(), UserId = _userId, CourseId = _courseId, Status = "failed" });

        var result = await _handler.Handle(new RequestAudioOverviewCommand(_userId, _courseId), default);

        Assert.True(result.IsSuccess);
        Assert.Equal("pending", result.Data!.Status);
        _overviews.Verify(r => r.AddAsync(It.IsAny<CourseAudioOverview>(), default), Times.Once);
    }
}

public class GenerateAudioOverviewCommandHandlerTests
{
    private readonly Mock<IUnitOfWork> _uow = new();
    private readonly Mock<ICourseAudioOverviewRepository> _overviews = new();
    private readonly Mock<ICourseRepository> _courses = new();
    private readonly Mock<IDocumentRepository> _documents = new();
    private readonly Mock<IVideoRepository> _videos = new();
    private readonly Mock<IAiService> _ai = new();
    private readonly Mock<ITtsSynthesisService> _tts = new();
    private readonly Mock<IBlobStorageService> _blobStorage = new();
    private readonly GenerateAudioOverviewCommandHandler _handler;
    private readonly Guid _overviewId = Guid.NewGuid();
    private readonly Guid _userId = Guid.NewGuid();
    private readonly Guid _courseId = Guid.NewGuid();

    public GenerateAudioOverviewCommandHandlerTests()
    {
        _uow.Setup(u => u.CourseAudioOverviews).Returns(_overviews.Object);
        _uow.Setup(u => u.Courses).Returns(_courses.Object);
        _uow.Setup(u => u.Documents).Returns(_documents.Object);
        _uow.Setup(u => u.Videos).Returns(_videos.Object);
        _uow.Setup(u => u.SaveChangesAsync(default)).ReturnsAsync(1);
        _uow.Setup(u => u.SaveChangesAsync(CancellationToken.None)).ReturnsAsync(1);
        _courses.Setup(r => r.GetByIdAsync(_courseId, default)).ReturnsAsync(new Course { CourseId = _courseId, UserId = _userId, CourseName = "Algorithms" });
        _documents.Setup(r => r.FindAsync(It.IsAny<Expression<Func<Document, bool>>>(), default)).ReturnsAsync(Array.Empty<Document>());
        _videos.Setup(r => r.FindAsync(It.IsAny<Expression<Func<Video, bool>>>(), default)).ReturnsAsync(Array.Empty<Video>());
        _tts.Setup(t => t.SynthesizeAsync(It.IsAny<string>(), It.IsAny<string>(), default)).ReturnsAsync(new byte[3000]);
        _blobStorage.Setup(b => b.UploadAsync(It.IsAny<Stream>(), It.IsAny<string>(), "audio/mpeg", default)).ReturnsAsync("https://blob/audio.mp3");
        _handler = new GenerateAudioOverviewCommandHandler(_uow.Object, _ai.Object, _tts.Object, _blobStorage.Object, Mock.Of<ILogger<GenerateAudioOverviewCommandHandler>>());
    }

    private static string ScriptJson(params (string Speaker, string Text)[] turns) =>
        JsonSerializer.Serialize(turns.Select(t => new { t.Speaker, t.Text }));

    [Fact]
    public async Task Handle_OverviewNotFound_ReturnsFailure()
    {
        _overviews.Setup(r => r.GetByIdAsync(_overviewId, default)).ReturnsAsync((CourseAudioOverview?)null);

        var result = await _handler.Handle(new GenerateAudioOverviewCommand(_overviewId), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("NOT_FOUND", result.ErrorCode);
    }

    [Fact]
    public async Task Handle_ValidScript_ProducesReadyOverviewWithAudioUrl()
    {
        var overview = new CourseAudioOverview { Id = _overviewId, UserId = _userId, CourseId = _courseId, Status = "pending" };
        _overviews.Setup(r => r.GetByIdAsync(_overviewId, default)).ReturnsAsync(overview);
        _ai.Setup(a => a.GenerateAudioOverviewScriptAsync("Algorithms", It.IsAny<string>(), default))
            .ReturnsAsync(ScriptJson(("A", "Welcome!"), ("B", "Let's dive in.")));

        var result = await _handler.Handle(new GenerateAudioOverviewCommand(_overviewId), default);

        Assert.True(result.IsSuccess);
        Assert.Equal("ready", overview.Status);
        Assert.Equal("https://blob/audio.mp3", overview.AudioUrl);
        Assert.NotNull(overview.CompletedAt);
    }

    [Fact]
    public async Task Handle_EmptyScript_MarksOverviewFailed()
    {
        var overview = new CourseAudioOverview { Id = _overviewId, UserId = _userId, CourseId = _courseId, Status = "pending" };
        _overviews.Setup(r => r.GetByIdAsync(_overviewId, default)).ReturnsAsync(overview);
        _ai.Setup(a => a.GenerateAudioOverviewScriptAsync(It.IsAny<string>(), It.IsAny<string>(), default)).ReturnsAsync("[]");

        var result = await _handler.Handle(new GenerateAudioOverviewCommand(_overviewId), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("GENERATION_FAILED", result.ErrorCode);
        Assert.Equal("failed", overview.Status);
        Assert.Contains("no usable dialogue", overview.Error);
    }

    [Fact]
    public async Task Handle_MalformedScriptJson_MarksOverviewFailed()
    {
        var overview = new CourseAudioOverview { Id = _overviewId, UserId = _userId, CourseId = _courseId, Status = "pending" };
        _overviews.Setup(r => r.GetByIdAsync(_overviewId, default)).ReturnsAsync(overview);
        _ai.Setup(a => a.GenerateAudioOverviewScriptAsync(It.IsAny<string>(), It.IsAny<string>(), default)).ReturnsAsync("{bad json");

        var result = await _handler.Handle(new GenerateAudioOverviewCommand(_overviewId), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("failed", overview.Status);
    }

    [Fact]
    public async Task Handle_TtsThrows_MarksOverviewFailedWithErrorMessage()
    {
        var overview = new CourseAudioOverview { Id = _overviewId, UserId = _userId, CourseId = _courseId, Status = "pending" };
        _overviews.Setup(r => r.GetByIdAsync(_overviewId, default)).ReturnsAsync(overview);
        _ai.Setup(a => a.GenerateAudioOverviewScriptAsync(It.IsAny<string>(), It.IsAny<string>(), default))
            .ReturnsAsync(ScriptJson(("A", "Welcome!")));
        _tts.Setup(t => t.SynthesizeAsync(It.IsAny<string>(), It.IsAny<string>(), default)).ThrowsAsync(new InvalidOperationException("TTS unavailable"));

        var result = await _handler.Handle(new GenerateAudioOverviewCommand(_overviewId), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("TTS unavailable", overview.Error);
    }

    [Fact]
    public async Task Handle_SpeakerBSelectsVoiceB()
    {
        var overview = new CourseAudioOverview { Id = _overviewId, UserId = _userId, CourseId = _courseId, Status = "pending" };
        _overviews.Setup(r => r.GetByIdAsync(_overviewId, default)).ReturnsAsync(overview);
        _ai.Setup(a => a.GenerateAudioOverviewScriptAsync(It.IsAny<string>(), It.IsAny<string>(), default))
            .ReturnsAsync(ScriptJson(("B", "Let's dive in.")));

        await _handler.Handle(new GenerateAudioOverviewCommand(_overviewId), default);

        _tts.Verify(t => t.SynthesizeAsync("Let's dive in.", "en-US-AriaNeural", default), Times.Once);
    }

    [Fact]
    public async Task Handle_UnrecognizedSpeaker_DefaultsToVoiceA()
    {
        var overview = new CourseAudioOverview { Id = _overviewId, UserId = _userId, CourseId = _courseId, Status = "pending" };
        _overviews.Setup(r => r.GetByIdAsync(_overviewId, default)).ReturnsAsync(overview);
        _ai.Setup(a => a.GenerateAudioOverviewScriptAsync(It.IsAny<string>(), It.IsAny<string>(), default))
            .ReturnsAsync(ScriptJson(("Host1", "Welcome!")));

        await _handler.Handle(new GenerateAudioOverviewCommand(_overviewId), default);

        _tts.Verify(t => t.SynthesizeAsync("Welcome!", "en-US-GuyNeural", default), Times.Once);
    }

    [Fact]
    public async Task Handle_BlankTurnText_IsFilteredOut()
    {
        var overview = new CourseAudioOverview { Id = _overviewId, UserId = _userId, CourseId = _courseId, Status = "pending" };
        _overviews.Setup(r => r.GetByIdAsync(_overviewId, default)).ReturnsAsync(overview);
        _ai.Setup(a => a.GenerateAudioOverviewScriptAsync(It.IsAny<string>(), It.IsAny<string>(), default))
            .ReturnsAsync(ScriptJson(("A", "Welcome!"), ("B", "   ")));

        var result = await _handler.Handle(new GenerateAudioOverviewCommand(_overviewId), default);

        Assert.True(result.IsSuccess);
        _tts.Verify(t => t.SynthesizeAsync(It.IsAny<string>(), It.IsAny<string>(), default), Times.Once);
    }

    [Fact]
    public async Task Handle_DigestPrefersMostRecentlyUpdatedMaterials()
    {
        var overview = new CourseAudioOverview { Id = _overviewId, UserId = _userId, CourseId = _courseId, Status = "pending" };
        _overviews.Setup(r => r.GetByIdAsync(_overviewId, default)).ReturnsAsync(overview);
        _documents.Setup(r => r.FindAsync(It.IsAny<Expression<Func<Document, bool>>>(), default)).ReturnsAsync(new[]
        {
            new Document { DocumentId = Guid.NewGuid(), UserId = _userId, CourseId = _courseId, FileName = "Doc1", Summary = "Summary 1", UpdatedAt = DateTime.UtcNow.AddDays(-1) },
            new Document { DocumentId = Guid.NewGuid(), UserId = _userId, CourseId = _courseId, FileName = "Doc2", Summary = "Summary 2", UpdatedAt = DateTime.UtcNow },
        });
        string? capturedDigest = null;
        _ai.Setup(a => a.GenerateAudioOverviewScriptAsync(It.IsAny<string>(), It.IsAny<string>(), default))
            .Callback<string, string, CancellationToken>((_, digest, _) => capturedDigest = digest)
            .ReturnsAsync(ScriptJson(("A", "Welcome!")));

        await _handler.Handle(new GenerateAudioOverviewCommand(_overviewId), default);

        Assert.True(capturedDigest!.IndexOf("Doc2", StringComparison.Ordinal) < capturedDigest.IndexOf("Doc1", StringComparison.Ordinal));
    }
}
