using Microsoft.Extensions.Options;
using Moq;
using StudyPlatform.Application.Services;
using StudyPlatform.Application.Settings;
using StudyPlatform.Application.Videos.Commands;
using StudyPlatform.Application.Videos.Transcripts;
using StudyPlatform.Domain.Entities;
using StudyPlatform.Domain.Interfaces;
using Xunit;

namespace StudyPlatform.Tests.Videos;

public class TranscribeUploadedVideoCommandTests
{
    private readonly Mock<IUnitOfWork> _uow = new();
    private readonly Mock<IVideoRepository> _videos = new();
    private readonly Mock<IBlobStorageService> _blobs = new();
    private readonly Mock<ITranscriptionService> _whisper = new();
    private readonly Mock<IVideoTranscriptProvider> _transcripts = new();
    private readonly TranscribeUploadedVideoCommandHandler _handler;
    private readonly Guid _owner = Guid.NewGuid();

    public TranscribeUploadedVideoCommandTests()
    {
        _uow.Setup(u => u.Videos).Returns(_videos.Object);
        _handler = new TranscribeUploadedVideoCommandHandler(
            _uow.Object, _blobs.Object, _whisper.Object, _transcripts.Object, Options.Create(new CacheOptions()));
    }

    private Video Upload() => new()
    {
        VideoId = Guid.NewGuid(), UserId = _owner, SourceType = "upload", ExternalVideoId = "upload-x",
        VideoUrl = "s3://b/v.mp4", TranscriptionRequestedAt = DateTime.UtcNow,
    };

    [Fact]
    public async Task Transcribes_StoresSegments_AndClearsThePendingMarker()
    {
        var video = Upload();
        _videos.Setup(r => r.GetByIdAsync(video.VideoId, default)).ReturnsAsync(video);
        _blobs.Setup(b => b.DownloadAsync(video.VideoUrl, default)).ReturnsAsync(new MemoryStream([1, 2, 3]));
        _whisper.Setup(w => w.TranscribeAsync(It.IsAny<byte[]>(), "video/mp4", default))
            .ReturnsAsync("""[{"start":0,"end":2,"text":"hello"},{"start":2,"end":4,"text":"world"}]""");

        var result = await _handler.Handle(new TranscribeUploadedVideoCommand(video.VideoId, _owner), default);

        Assert.True(result.IsSuccess);
        Assert.Equal("hello world", video.Transcript);
        Assert.Null(video.TranscriptionRequestedAt);
        _transcripts.Verify(t => t.StoreSegmentsAsync("upload:upload-x", TranscriptKinds.Transcript,
            It.Is<IReadOnlyCollection<TranscriptSegmentDto>>(s => s.Count == 2), It.IsAny<TimeSpan>(), default), Times.Once);
    }

    [Fact]
    public async Task SomeoneElsesVideo_IsNotTranscribed()
    {
        var video = Upload();
        _videos.Setup(r => r.GetByIdAsync(video.VideoId, default)).ReturnsAsync(video);

        var result = await _handler.Handle(new TranscribeUploadedVideoCommand(video.VideoId, Guid.NewGuid()), default);

        Assert.False(result.IsSuccess);
        _blobs.VerifyNoOtherCalls();
    }
}
