using System.Net;
using StudyPlatform.Infrastructure.Http;
using Xunit;

namespace StudyPlatform.Tests.Services;

public class SsrfGuardRuntimeTests
{
    [Theory]
    [InlineData("http://127.0.0.1:9/")]              // loopback
    [InlineData("http://169.254.169.254/latest/")]   // cloud metadata
    [InlineData("http://[::1]:9/")]                  // IPv6 loopback
    public async Task Handler_RefusesBlockedHost(string url)
    {
        using var client = new HttpClient(SsrfGuard.CreateHandler()) { Timeout = TimeSpan.FromSeconds(5) };
        var ex = await Assert.ThrowsAsync<HttpRequestException>(() => client.GetAsync(url));
        Assert.Contains("private or reserved", ex.Message);
    }
}
