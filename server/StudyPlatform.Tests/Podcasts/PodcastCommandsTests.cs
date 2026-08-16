using Moq;
using StudyPlatform.Application.Podcasts.Commands;
using StudyPlatform.Application.Podcasts.Queries;
using StudyPlatform.Application.Services;
using StudyPlatform.Domain.Entities;
using StudyPlatform.Domain.Interfaces;
using Xunit;

namespace StudyPlatform.Tests.Podcasts;

public class CreatePodcastEpisodeCommandHandlerTests
{
    private readonly Mock<IUnitOfWork> _uow = new();
    private readonly Mock<ICourseRepository> _courses = new();
    private readonly Mock<IDocumentRepository> _documents = new();
    private readonly Mock<IPodcastEpisodeService> _podcastService = new();
    private readonly CreatePodcastEpisodeCommandHandler _handler;
    private readonly Guid _userId = Guid.NewGuid();
    private readonly Guid _courseId = Guid.NewGuid();

    public CreatePodcastEpisodeCommandHandlerTests()
    {
        _uow.Setup(u => u.Courses).Returns(_courses.Object);
        _uow.Setup(u => u.Documents).Returns(_documents.Object);
        _uow.Setup(u => u.SaveChangesAsync(default)).ReturnsAsync(1);
        _courses.Setup(r => r.GetByIdAsync(_courseId, default)).ReturnsAsync(new Course { CourseId = _courseId, UserId = _userId });
        _documents.Setup(r => r.AddAsync(It.IsAny<Document>(), default)).Returns(Task.CompletedTask);
        _handler = new CreatePodcastEpisodeCommandHandler(_uow.Object, _podcastService.Object);
    }

    [Fact]
    public async Task Handle_CourseNotOwned_ReturnsFailure()
    {
        _courses.Setup(r => r.GetByIdAsync(_courseId, default)).ReturnsAsync(new Course { CourseId = _courseId, UserId = Guid.NewGuid() });

        var result = await _handler.Handle(new CreatePodcastEpisodeCommand(_userId, _courseId, "https://x.com/ep1"), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("COURSE_NOT_FOUND", result.ErrorCode);
    }

    [Fact]
    public async Task Handle_UrlIsAFeed_ReturnsRssFeedUrlError()
    {
        _podcastService.Setup(s => s.GetEpisodeInfoAsync("https://x.com/feed", default)).ReturnsAsync((PodcastEpisodeInfo?)null);
        _podcastService.Setup(s => s.GetFeedAsync("https://x.com/feed", default))
            .ReturnsAsync(new PodcastFeedInfo("Show", "thumb.jpg", new List<PodcastFeedEpisode>()));

        var result = await _handler.Handle(new CreatePodcastEpisodeCommand(_userId, _courseId, "https://x.com/feed"), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("RSS_FEED_URL", result.ErrorCode);
    }

    [Fact]
    public async Task Handle_UnrecognizedUrl_ReturnsFetchFailed()
    {
        _podcastService.Setup(s => s.GetEpisodeInfoAsync(It.IsAny<string>(), default)).ReturnsAsync((PodcastEpisodeInfo?)null);
        _podcastService.Setup(s => s.GetFeedAsync(It.IsAny<string>(), default)).ReturnsAsync((PodcastFeedInfo?)null);

        var result = await _handler.Handle(new CreatePodcastEpisodeCommand(_userId, _courseId, "https://x.com/nope"), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("PODCAST_FETCH_FAILED", result.ErrorCode);
    }

    [Fact]
    public async Task Handle_ValidEpisode_CreatesDocumentAsPodcastContentType()
    {
        _podcastService.Setup(s => s.GetEpisodeInfoAsync("https://x.com/ep1", default))
            .ReturnsAsync(new PodcastEpisodeInfo("Episode 1", "Show", "https://audio/ep1.mp3", "thumb.jpg", "desc", 60000));
        Document? captured = null;
        _documents.Setup(r => r.AddAsync(It.IsAny<Document>(), default))
            .Callback<Document, CancellationToken>((d, _) => captured = d)
            .Returns(Task.CompletedTask);

        var result = await _handler.Handle(new CreatePodcastEpisodeCommand(_userId, _courseId, "https://x.com/ep1"), default);

        Assert.True(result.IsSuccess);
        Assert.Equal("Episode 1", captured!.FileName);
        Assert.Equal("audio/podcast", captured.ContentType);
        Assert.Equal("https://audio/ep1.mp3", captured.BlobUrl);
        Assert.Equal("https://x.com/ep1", captured.OriginalUrl);
    }
}

public class CreatePodcastFromFeedCommandHandlerTests
{
    private readonly Mock<IUnitOfWork> _uow = new();
    private readonly Mock<ICourseRepository> _courses = new();
    private readonly Mock<IDocumentRepository> _documents = new();
    private readonly Mock<IPodcastEpisodeService> _podcastService = new();
    private readonly CreatePodcastFromFeedCommandHandler _handler;
    private readonly Guid _userId = Guid.NewGuid();
    private readonly Guid _courseId = Guid.NewGuid();

    public CreatePodcastFromFeedCommandHandlerTests()
    {
        _uow.Setup(u => u.Courses).Returns(_courses.Object);
        _uow.Setup(u => u.Documents).Returns(_documents.Object);
        _uow.Setup(u => u.SaveChangesAsync(default)).ReturnsAsync(1);
        _courses.Setup(r => r.GetByIdAsync(_courseId, default)).ReturnsAsync(new Course { CourseId = _courseId, UserId = _userId });
        _documents.Setup(r => r.AddAsync(It.IsAny<Document>(), default)).Returns(Task.CompletedTask);
        _handler = new CreatePodcastFromFeedCommandHandler(_uow.Object, _podcastService.Object);
    }

    [Fact]
    public async Task Handle_CourseNotOwned_ReturnsFailure()
    {
        _courses.Setup(r => r.GetByIdAsync(_courseId, default)).ReturnsAsync((Course?)null);

        var result = await _handler.Handle(new CreatePodcastFromFeedCommand(_userId, _courseId, "https://feed.xml", "ep-1"), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("COURSE_NOT_FOUND", result.ErrorCode);
    }

    [Fact]
    public async Task Handle_FeedFetchFails_ReturnsFailure()
    {
        _podcastService.Setup(s => s.GetFeedAsync("https://feed.xml", default)).ReturnsAsync((PodcastFeedInfo?)null);

        var result = await _handler.Handle(new CreatePodcastFromFeedCommand(_userId, _courseId, "https://feed.xml", "ep-1"), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("FEED_FETCH_FAILED", result.ErrorCode);
    }

    [Fact]
    public async Task Handle_EpisodeIdNotInFeed_ReturnsFailure()
    {
        _podcastService.Setup(s => s.GetFeedAsync("https://feed.xml", default))
            .ReturnsAsync(new PodcastFeedInfo("Show", "thumb", new List<PodcastFeedEpisode>()));

        var result = await _handler.Handle(new CreatePodcastFromFeedCommand(_userId, _courseId, "https://feed.xml", "missing"), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("EPISODE_NOT_FOUND", result.ErrorCode);
    }

    [Fact]
    public async Task Handle_MatchesEpisodeById()
    {
        var episode = new PodcastFeedEpisode("ep-1", "Episode One", "https://audio/ep1.mp3", "https://link/ep1", "desc", "thumb", 1000, null);
        _podcastService.Setup(s => s.GetFeedAsync("https://feed.xml", default))
            .ReturnsAsync(new PodcastFeedInfo("Show", "thumb", new List<PodcastFeedEpisode> { episode }));

        var result = await _handler.Handle(new CreatePodcastFromFeedCommand(_userId, _courseId, "https://feed.xml", "ep-1"), default);

        Assert.True(result.IsSuccess);
        Assert.Equal("Episode One", result.Data!.FileName);
    }

    [Fact]
    public async Task Handle_FallsBackToMatchingByAudioUrl()
    {
        var episode = new PodcastFeedEpisode("ep-1", "Episode One", "https://audio/ep1.mp3", "https://link/ep1", "desc", "thumb", 1000, null);
        _podcastService.Setup(s => s.GetFeedAsync("https://feed.xml", default))
            .ReturnsAsync(new PodcastFeedInfo("Show", "thumb", new List<PodcastFeedEpisode> { episode }));

        var result = await _handler.Handle(new CreatePodcastFromFeedCommand(_userId, _courseId, "https://feed.xml", "https://audio/ep1.mp3"), default);

        Assert.True(result.IsSuccess);
    }

    [Fact]
    public async Task Handle_MissingLink_FallsBackToAudioUrlAsOriginalUrl()
    {
        var episode = new PodcastFeedEpisode("ep-1", "Episode One", "https://audio/ep1.mp3", "", "desc", "thumb", 1000, null);
        _podcastService.Setup(s => s.GetFeedAsync("https://feed.xml", default))
            .ReturnsAsync(new PodcastFeedInfo("Show", "thumb", new List<PodcastFeedEpisode> { episode }));
        Document? captured = null;
        _documents.Setup(r => r.AddAsync(It.IsAny<Document>(), default))
            .Callback<Document, CancellationToken>((d, _) => captured = d)
            .Returns(Task.CompletedTask);

        await _handler.Handle(new CreatePodcastFromFeedCommand(_userId, _courseId, "https://feed.xml", "ep-1"), default);

        Assert.Equal("https://audio/ep1.mp3", captured!.OriginalUrl);
    }
}

public class TranscribePodcastCommandHandlerTests
{
    private readonly Mock<IUnitOfWork> _uow = new();
    private readonly Mock<IDocumentRepository> _documents = new();
    private readonly Mock<ITranscriptionService> _transcription = new();
    private readonly Mock<IPodcastEpisodeService> _podcastService = new();
    private readonly TranscribePodcastCommandHandler _handler;
    private readonly Guid _userId = Guid.NewGuid();
    private readonly Guid _documentId = Guid.NewGuid();

    public TranscribePodcastCommandHandlerTests()
    {
        _uow.Setup(u => u.Documents).Returns(_documents.Object);
        _uow.Setup(u => u.SaveChangesAsync(default)).ReturnsAsync(1);
        _handler = new TranscribePodcastCommandHandler(_uow.Object, _transcription.Object, _podcastService.Object);
    }

    [Fact]
    public async Task Handle_DocumentNotOwned_ReturnsFailure()
    {
        _documents.Setup(r => r.GetByIdAsync(_documentId, default)).ReturnsAsync((Document?)null);

        var result = await _handler.Handle(new TranscribePodcastCommand(_documentId, _userId), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("DOCUMENT_NOT_FOUND", result.ErrorCode);
    }

    [Fact]
    public async Task Handle_NotAPodcast_ReturnsFailure()
    {
        _documents.Setup(r => r.GetByIdAsync(_documentId, default))
            .ReturnsAsync(new Document { DocumentId = _documentId, UserId = _userId, ContentType = "application/pdf" });

        var result = await _handler.Handle(new TranscribePodcastCommand(_documentId, _userId), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("INVALID_DOCUMENT_TYPE", result.ErrorCode);
    }

    [Fact]
    public async Task Handle_AlreadyTranscribed_SkipsDownloadAndTranscription()
    {
        _documents.Setup(r => r.GetByIdAsync(_documentId, default))
            .ReturnsAsync(new Document { DocumentId = _documentId, UserId = _userId, ContentType = "audio/podcast", Transcript = "already done" });

        var result = await _handler.Handle(new TranscribePodcastCommand(_documentId, _userId), default);

        Assert.True(result.IsSuccess);
        _podcastService.Verify(s => s.DownloadAudioAsync(It.IsAny<string>(), default), Times.Never);
    }

    [Fact]
    public async Task Handle_DownloadFails_ReturnsFailure()
    {
        _documents.Setup(r => r.GetByIdAsync(_documentId, default))
            .ReturnsAsync(new Document { DocumentId = _documentId, UserId = _userId, ContentType = "audio/podcast", BlobUrl = "https://audio/ep1.mp3" });
        _podcastService.Setup(s => s.DownloadAudioAsync("https://audio/ep1.mp3", default)).ReturnsAsync(((byte[], string)?)null);

        var result = await _handler.Handle(new TranscribePodcastCommand(_documentId, _userId), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("DOWNLOAD_FAILED", result.ErrorCode);
    }

    [Fact]
    public async Task Handle_ValidDownload_TranscribesAndSaves()
    {
        var document = new Document { DocumentId = _documentId, UserId = _userId, ContentType = "audio/podcast", BlobUrl = "https://audio/ep1.mp3" };
        _documents.Setup(r => r.GetByIdAsync(_documentId, default)).ReturnsAsync(document);
        _podcastService.Setup(s => s.DownloadAudioAsync("https://audio/ep1.mp3", default))
            .ReturnsAsync((new byte[] { 1, 2, 3 }, "audio/mpeg"));
        _transcription.Setup(t => t.TranscribeAsync(It.IsAny<byte[]>(), "audio/mpeg", default)).ReturnsAsync("transcribed text");

        var result = await _handler.Handle(new TranscribePodcastCommand(_documentId, _userId), default);

        Assert.True(result.IsSuccess);
        Assert.Equal("transcribed text", document.Transcript);
        _documents.Verify(r => r.Update(document), Times.Once);
    }
}

public class GetPodcastFeedQueryHandlerTests
{
    private readonly Mock<IPodcastEpisodeService> _podcastService = new();
    private readonly GetPodcastFeedQueryHandler _handler;

    public GetPodcastFeedQueryHandlerTests()
    {
        _handler = new GetPodcastFeedQueryHandler(_podcastService.Object);
    }

    [Fact]
    public async Task Handle_FeedFetchFails_ReturnsFailure()
    {
        _podcastService.Setup(s => s.GetFeedAsync("https://feed.xml", default)).ReturnsAsync((PodcastFeedInfo?)null);

        var result = await _handler.Handle(new GetPodcastFeedQuery("https://feed.xml"), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("FEED_FETCH_FAILED", result.ErrorCode);
    }

    [Fact]
    public async Task Handle_ValidFeed_ReturnsIt()
    {
        var feed = new PodcastFeedInfo("Show", "thumb", new List<PodcastFeedEpisode>());
        _podcastService.Setup(s => s.GetFeedAsync("https://feed.xml", default)).ReturnsAsync(feed);

        var result = await _handler.Handle(new GetPodcastFeedQuery("https://feed.xml"), default);

        Assert.True(result.IsSuccess);
        Assert.Equal("Show", result.Data!.Title);
    }
}
