using StudyPlatform.Application.Videos;
using Xunit;

namespace StudyPlatform.Tests.Videos;

/// <summary>
/// The source type is written on save and read back on every transcript fetch and cache-key build.
/// A video saved as "Bilibili" must hit the cache entry written for "bilibili".
/// </summary>
public class VideoSourceTypesTests
{
    [Theory]
    [InlineData("bilibili")]
    [InlineData("upload")]
    [InlineData("vimeo")]
    [InlineData("ted")]
    [InlineData("dailymotion")]
    [InlineData("facebook")]
    [InlineData("instagram")]
    [InlineData("twitter")]
    [InlineData("reddit")]
    [InlineData("linkedin")]
    [InlineData("tiktok")]
    [InlineData("youtube")]
    public void Normalize_KeepsAKnownSourceAsItIs(string source)
        => Assert.Equal(source, VideoSourceTypes.Normalize(source));

    [Theory]
    [InlineData("Bilibili")]
    [InlineData("BILIBILI")]
    [InlineData("  bilibili  ")]
    [InlineData("\tBiliBili\n")]
    public void Normalize_IsInsensitiveToCasingAndSurroundingSpace(string source)
        => Assert.Equal("bilibili", VideoSourceTypes.Normalize(source));

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    [InlineData("myspace")]
    public void Normalize_FallsBackToYouTubeForAnythingUnrecognised(string? source)
        => Assert.Equal(VideoSourceTypes.Default, VideoSourceTypes.Normalize(source));

    [Fact]
    public void Default_IsYouTube() => Assert.Equal("youtube", VideoSourceTypes.Default);

    [Fact]
    public void Normalize_IsIdempotent()
    {
        var once = VideoSourceTypes.Normalize(" Vimeo ");
        Assert.Equal(once, VideoSourceTypes.Normalize(once));
    }
}
