using Microsoft.Extensions.Options;
using Moq;
using StudyPlatform.Application.Services;
using StudyPlatform.Application.Settings;
using StudyPlatform.Application.Videos.Transcripts;
using StudyPlatform.Domain.Entities;
using StudyPlatform.Domain.Interfaces;
using Xunit;

namespace StudyPlatform.Tests.Videos;

public class VideoTranscriptProviderTests
{
    private readonly Mock<IAppCache> _cache = new();
    private readonly Mock<IUnitOfWork> _uow = new();
    private readonly Mock<IVideoRepository> _videos = new();
    private readonly Mock<IYouTubeTranscriptService> _source = new();
    private readonly Mock<ITranscriptSegmentStore> _store = new();
    private readonly VideoTranscriptProvider _provider;

    public VideoTranscriptProviderTests()
    {
        _uow.Setup(u => u.Videos).Returns(_videos.Object);
        _provider = new VideoTranscriptProvider(_cache.Object, _uow.Object, _source.Object, _store.Object,
            Options.Create(new CacheOptions()));
    }

    private static Video YouTube(string? transcript = null) => new()
    {
        VideoId = Guid.NewGuid(), ExternalVideoId = "abc123", SourceType = "youtube",
        VideoUrl = "https://youtu.be/abc123", Transcript = transcript,
    };

    [Fact]
    public async Task SavedTranscriptOnTheVideo_IsUsedWithoutFetching()
    {
        var text = await _provider.GetOrFetchTranscriptAsync(YouTube("hello world"), default);

        Assert.Equal("hello world", text);
        _source.VerifyNoOtherCalls();
    }

    [Fact]
    public async Task OnAMiss_PrefersAuthorSubtitles_AndWritesBackToTheVideoAndStore()
    {
        var video = YouTube();
        _source.Setup(s => s.GetSubtitlesAsync("abc123", default))
            .ReturnsAsync([new TranscriptSegment(TimeSpan.Zero, "first"), new TranscriptSegment(TimeSpan.FromSeconds(5), "second")]);

        var text = await _provider.GetOrFetchTranscriptAsync(video, default);

        Assert.Equal("first second", text);
        Assert.Equal("first second", video.Transcript);
        _source.Verify(s => s.GetTranscriptAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()), Times.Never);
        _store.Verify(s => s.UpsertAsync("youtube:abc123", TranscriptKinds.Subtitles,
            It.Is<IReadOnlyCollection<TranscriptSegmentDto>>(x => x.Count == 2), It.IsAny<TimeSpan>(), default), Times.Once);
    }

    [Fact]
    public async Task ExternalSources_AreFetchedByUrl()
    {
        var video = new Video { ExternalVideoId = "BV1xx", SourceType = "bilibili", VideoUrl = "https://www.bilibili.com/video/BV1xx" };
        _source.Setup(s => s.GetSubtitlesFromUrlAsync(video.VideoUrl, default))
            .ReturnsAsync([new TranscriptSegment(TimeSpan.Zero, "hi")]);

        Assert.Equal("hi", await _provider.GetOrFetchTranscriptAsync(video, default));
        _source.Verify(s => s.GetSubtitlesAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task SegmentOffsets_LineUpWithTheJoinedTranscript()
    {
        _store.Setup(s => s.GetAsync("youtube:abc123", TranscriptKinds.Subtitles, default))
            .ReturnsAsync([new TranscriptSegmentDto(0, "ab"), new TranscriptSegmentDto(4, "cde")]);

        var offsets = await _provider.GetSegmentOffsetsAsync(YouTube(), default);

        // "ab cde": the second segment starts after "ab" plus the joining space.
        Assert.Equal([(0d, 0), (4d, 3)], offsets!);
    }
}

public class TranscriptSegmentationTests
{
    [Fact]
    public void CaptionFragments_AreGroupedIntoReadablePassages()
    {
        var fragments = Enumerable.Range(0, 30).Select(i => new TranscriptSegmentDto(i * 4, $"w{i}"));

        var passages = TranscriptSegmentation.SegmentForReading(fragments);

        Assert.InRange(passages.Count, 2, 4); // 120 s of 4 s fragments → 30–60 s passages
        Assert.All(passages.Zip(passages.Skip(1)), p => Assert.True(p.Second.StartSeconds - p.First.StartSeconds >= 30));
    }

    [Fact]
    public void Format_RendersTimestampRanges()
        => Assert.Equal("00:00 – 00:30 a\n00:30 b",
            TranscriptSegmentation.Format([new TranscriptSegmentDto(0, "a"), new TranscriptSegmentDto(30, "b")]));

    [Fact]
    public void ParseWhisper_ToleratesGarbage()
        => Assert.Empty(TranscriptSegmentation.ParseWhisper("not json"));
}
