using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using Moq;
using StudyPlatform.Application.Common;
using StudyPlatform.Application.Services;
using StudyPlatform.Application.Settings;
using StudyPlatform.Infrastructure.Services;
using Xunit;

namespace StudyPlatform.Tests.Services;

/// <summary>
/// A provider that never answers must fail fast with a clear AI_TIMEOUT — below CloudFront's 60 s — not
/// hold the request until the CDN returns a bare 504 while the provider keeps billing the user's key.
/// </summary>
public class AiServiceTimeoutTests
{
    private sealed class NeverAnswers : HttpMessageHandler
    {
        protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
        {
            await Task.Delay(Timeout.Infinite, cancellationToken);
            throw new InvalidOperationException("unreachable");
        }
    }

    private static AiService Service(int timeoutSeconds) => new(
        new HttpClient(new NeverAnswers()) { Timeout = Timeout.InfiniteTimeSpan },
        NullLogger<AiService>.Instance,
        AiTestCredentials.Accessor("openai", "gpt-4o-mini", "sk-test"),
        Mock.Of<IAppCache>(),
        Options.Create(new CacheOptions()),
        Mock.Of<IAiUsageRecorder>(),
        Options.Create(new AiRequestOptions { NonStreamingTimeoutSeconds = timeoutSeconds }));

    [Fact]
    public async Task StalledProvider_FailsWithAiTimeout()
    {
        var ex = await Assert.ThrowsAsync<UserFacingException>(() => Service(1).TestConnectionAsync());

        Assert.Equal("AI_TIMEOUT", ex.ErrorCode);
        Assert.Equal(504, ex.StatusCode);
    }

    [Fact]
    public async Task CallerCancelling_IsACancellation_NotATimeout()
    {
        using var cts = new CancellationTokenSource(TimeSpan.FromMilliseconds(100));

        await Assert.ThrowsAnyAsync<OperationCanceledException>(() => Service(30).TestConnectionAsync(cts.Token));
    }
}
