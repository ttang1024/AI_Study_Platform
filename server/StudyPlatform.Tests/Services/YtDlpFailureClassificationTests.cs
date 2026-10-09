using StudyPlatform.Infrastructure.Services;
using Xunit;
using FailureType = StudyPlatform.Infrastructure.Services.YouTubeTranscriptService.YtDlpFailureType;

namespace StudyPlatform.Tests.Services;

// Enum members are passed by name: the enum is internal and xUnit theories are public.
// A blocked yt-dlp run (dead proxy, bot wall) must surface as "upstream unavailable",
// never as "this video has no captions".
public class YtDlpFailureClassificationTests
{
    [Theory]
    [InlineData("ERROR: [youtube] x: Unable to download API page: <urlopen error Tunnel connection failed: 407 Proxy Authentication Required>", "ProxyError")]
    [InlineData("ERROR: [youtube] x: Sign in to confirm you’re not a bot. Use --cookies-from-browser", "BotDetection")]
    [InlineData("ERROR: [youtube] x: HTTP Error 429: Too Many Requests", "BotDetection")]
    [InlineData("ERROR: [youtube] x: Video unavailable", "NotRetryable")]
    [InlineData("ERROR: [youtube] x: Private video", "NotRetryable")]
    [InlineData("ERROR: something new", "Unknown")]
    public void ClassifyFailure_RecognisesYtDlpStderr(string stderr, string expected)
    {
        Assert.Equal(expected, YouTubeTranscriptService.ClassifyFailure(stderr).ToString());
    }

    [Theory]
    [InlineData("ProxyError", true)]
    [InlineData("BotDetection", true)]
    [InlineData("NotRetryable", false)]
    [InlineData("Unknown", false)]
    public void IsBlocked_OnlyForProxyAndBotFailures(string failure, bool expected)
    {
        Assert.Equal(expected, YouTubeTranscriptService.IsBlocked(Enum.Parse<FailureType>(failure)));
    }
}
