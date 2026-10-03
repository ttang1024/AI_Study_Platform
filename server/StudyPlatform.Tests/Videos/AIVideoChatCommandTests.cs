using Moq;
using StudyPlatform.Application.Services;
using StudyPlatform.Application.Videos.Commands;
using StudyPlatform.Domain.Entities;
using StudyPlatform.Domain.Interfaces;
using Xunit;

namespace StudyPlatform.Tests.Videos;

public class AIVideoChatCommandHandlerTests
{
    private readonly Mock<IUnitOfWork> _uow = new();
    private readonly Mock<IVideoRepository> _videos = new();
    private readonly Mock<IChatMessageRepository> _chat = new();
    private readonly Mock<IAiService> _ai = new();
    private readonly Mock<IYouTubeTranscriptService> _transcript = new();
    private readonly AIVideoChatCommandHandler _handler;
    private readonly Guid _userId = Guid.NewGuid();
    private readonly Guid _videoId = Guid.NewGuid();

    public AIVideoChatCommandHandlerTests()
    {
        _uow.Setup(u => u.Videos).Returns(_videos.Object);
        _uow.Setup(u => u.ChatMessages).Returns(_chat.Object);
        _uow.Setup(u => u.SaveChangesAsync(default)).ReturnsAsync(1);
        _chat.Setup(r => r.GetByVideoIdAsync(_videoId, _userId, default)).ReturnsAsync(Array.Empty<ChatMessage>());
        _chat.Setup(r => r.AddAsync(It.IsAny<ChatMessage>(), default)).Returns(Task.CompletedTask);
        _ai.Setup(a => a.ChatWithYouTubeAsync(It.IsAny<string>(), It.IsAny<IEnumerable<(string, string)>>(), It.IsAny<string>(), default))
            .ReturnsAsync("AI response");
        _handler = new AIVideoChatCommandHandler(_uow.Object, _ai.Object, _transcript.Object);
    }

    [Fact]
    public async Task Handle_VideoNotFound_ReturnsFailure()
    {
        _videos.Setup(r => r.GetByIdForUserAsync(_videoId, _userId, default)).ReturnsAsync((Video?)null);

        var result = await _handler.Handle(new AIVideoChatCommand(_videoId, _userId, "hi"), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("VIDEO_NOT_FOUND", result.ErrorCode);
    }

    [Fact]
    public async Task Handle_StoredTranscript_SkipsFetchingFromYouTube()
    {
        _videos.Setup(r => r.GetByIdForUserAsync(_videoId, _userId, default))
            .ReturnsAsync(new Video { VideoId = _videoId, UserId = _userId, Transcript = "existing transcript" });

        var result = await _handler.Handle(new AIVideoChatCommand(_videoId, _userId, "hi"), default);

        Assert.True(result.IsSuccess);
        _transcript.Verify(t => t.GetTranscriptAsync(It.IsAny<string>(), default), Times.Never);
        _ai.Verify(a => a.ChatWithYouTubeAsync("existing transcript", It.IsAny<IEnumerable<(string, string)>>(), "hi", default), Times.Once);
    }

    [Fact]
    public async Task Handle_NoStoredTranscript_FetchesAndPersistsIt()
    {
        var video = new Video { VideoId = _videoId, UserId = _userId, ExternalVideoId = "ext-1", Transcript = null };
        _videos.Setup(r => r.GetByIdForUserAsync(_videoId, _userId, default)).ReturnsAsync(video);
        _transcript.Setup(t => t.GetTranscriptAsync("ext-1", default))
            .ReturnsAsync(new[] { new TranscriptSegment(TimeSpan.Zero, "Hello"), new TranscriptSegment(TimeSpan.FromSeconds(5), "world") });

        await _handler.Handle(new AIVideoChatCommand(_videoId, _userId, "hi"), default);

        Assert.Equal("Hello world", video.Transcript);
        _videos.Verify(r => r.Update(video), Times.Once);
    }

    [Fact]
    public async Task Handle_NoTranscriptFromCaptions_FallsBackToSubtitles()
    {
        var video = new Video { VideoId = _videoId, UserId = _userId, ExternalVideoId = "ext-1", Transcript = null };
        _videos.Setup(r => r.GetByIdForUserAsync(_videoId, _userId, default)).ReturnsAsync(video);
        _transcript.Setup(t => t.GetTranscriptAsync("ext-1", default)).ReturnsAsync((IReadOnlyList<TranscriptSegment>?)null);
        _transcript.Setup(t => t.GetSubtitlesAsync("ext-1", default))
            .ReturnsAsync(new[] { new TranscriptSegment(TimeSpan.Zero, "Subtitle text") });

        await _handler.Handle(new AIVideoChatCommand(_videoId, _userId, "hi"), default);

        Assert.Equal("Subtitle text", video.Transcript);
    }

    [Fact]
    public async Task Handle_NoTranscriptAvailableAnywhere_UsesEmptyStringAndDoesNotPersist()
    {
        var video = new Video { VideoId = _videoId, UserId = _userId, ExternalVideoId = "ext-1", Transcript = null };
        _videos.Setup(r => r.GetByIdForUserAsync(_videoId, _userId, default)).ReturnsAsync(video);
        _transcript.Setup(t => t.GetTranscriptAsync("ext-1", default)).ReturnsAsync((IReadOnlyList<TranscriptSegment>?)null);
        _transcript.Setup(t => t.GetSubtitlesAsync("ext-1", default)).ReturnsAsync((IReadOnlyList<TranscriptSegment>?)null);

        await _handler.Handle(new AIVideoChatCommand(_videoId, _userId, "hi"), default);

        Assert.Null(video.Transcript);
        _videos.Verify(r => r.Update(It.IsAny<Video>()), Times.Never);
    }

    [Fact]
    public async Task Handle_StoresBothUserAndAssistantMessages()
    {
        _videos.Setup(r => r.GetByIdForUserAsync(_videoId, _userId, default))
            .ReturnsAsync(new Video { VideoId = _videoId, UserId = _userId, Transcript = "t" });

        await _handler.Handle(new AIVideoChatCommand(_videoId, _userId, "hi"), default);

        _chat.Verify(r => r.AddAsync(It.Is<ChatMessage>(m => m.Role == "user" && m.Content == "hi"), default), Times.Once);
        _chat.Verify(r => r.AddAsync(It.Is<ChatMessage>(m => m.Role == "assistant" && m.Content == "AI response"), default), Times.Once);
    }

    [Fact]
    public async Task Handle_ReturnsAssistantMessageDto()
    {
        _videos.Setup(r => r.GetByIdForUserAsync(_videoId, _userId, default))
            .ReturnsAsync(new Video { VideoId = _videoId, UserId = _userId, Transcript = "t" });

        var result = await _handler.Handle(new AIVideoChatCommand(_videoId, _userId, "hi"), default);

        Assert.Equal("AI response", result.Data!.Content);
        Assert.Equal("assistant", result.Data.Role);
        Assert.Equal(_videoId, result.Data.VideoId);
    }
}
