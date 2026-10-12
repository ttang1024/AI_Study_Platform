using StudyPlatform.Infrastructure.Services;
using Xunit;

namespace StudyPlatform.Tests.Services;

// Pool proxy URLs carry the proxy account's credentials; only host:port may reach a log line.
public class YouTubeCredentialPoolTests
{
    [Theory]
    [InlineData("http://user:s3cret@proxy.example.com:8080", "proxy.example.com:8080")]
    [InlineData("http://proxy.example.com:3128", "proxy.example.com:3128")]
    [InlineData(null, "none")]
    [InlineData("", "none")]
    [InlineData("not a url", "[unparseable proxy]")]
    public void Describe_NeverIncludesCredentials(string? proxy, string expected)
    {
        var described = YouTubeCredentialPool.Describe(proxy);

        Assert.Equal(expected, described);
        Assert.DoesNotContain("s3cret", described);
    }
}
