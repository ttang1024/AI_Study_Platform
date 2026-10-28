using System.Net;
using System.Text;
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
/// What a caller gets when the provider does not answer the way the happy path assumes. Every one of
/// these has to surface as an AI error the client can act on — not as an unrelated status the
/// middleware maps from whatever generic exception parsing happened to throw.
/// </summary>
public class AiServiceProviderFailureTests
{
    private sealed class Respond(HttpStatusCode status, string body, string mediaType = "application/json") : HttpMessageHandler
    {
        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
            => Task.FromResult(new HttpResponseMessage(status) { Content = new StringContent(body, Encoding.UTF8, mediaType) });
    }

    private static AiService Service(HttpMessageHandler handler, string provider) => new(
        new HttpClient(handler) { Timeout = Timeout.InfiniteTimeSpan },
        NullLogger<AiService>.Instance,
        AiTestCredentials.Provider(provider, "model", "key"),
        Mock.Of<IAppCache>(),
        Options.Create(new CacheOptions()),
        Mock.Of<IAiUsageRecorder>(),
        Options.Create(new AiRequestOptions()));

    [Theory]
    [InlineData(HttpStatusCode.TooManyRequests, "TooManyRequests")]
    [InlineData(HttpStatusCode.InternalServerError, "InternalServerError")]
    [InlineData(HttpStatusCode.Unauthorized, "Unauthorized")]
    public async Task NonSuccessStatus_IsAProviderError_NamingTheStatus(HttpStatusCode status, string named)
    {
        var ai = Service(new Respond(status, """{"error":{"message":"nope"}}"""), "openai");

        var ex = await Assert.ThrowsAsync<AiProviderException>(() => ai.GeneralChatAsync([], "hi"));
        Assert.Contains(named, ex.Message);
    }

    [Fact]
    public async Task NonSuccessStatus_WhileStreaming_IsAProviderError()
    {
        var ai = Service(new Respond(HttpStatusCode.ServiceUnavailable, "overloaded"), "claude");

        var ex = await Assert.ThrowsAsync<AiProviderException>(async () =>
        {
            await foreach (var _ in ai.StreamSummaryAsync("text")) { }
        });
        Assert.Contains("ServiceUnavailable", ex.Message);
    }

    [Fact]
    public async Task WellFormedAnswer_IsReturnedTrimmed()
    {
        var ai = Service(new Respond(HttpStatusCode.OK, """{"choices":[{"message":{"content":"  Hello  "}}]}"""), "openai");

        Assert.Equal("Hello", await ai.GeneralChatAsync([], "hi"));
    }

    // 200 responses the extraction does not expect. Each used to escape as a generic parsing exception —
    // KeyNotFoundException became 404 "Resource not found" in the middleware, the rest a bare 500.
    public static TheoryData<string, string, string> UnexpectedSuccessBodies => new()
    {
        { "gemini", """{"candidates":[{"finishReason":"SAFETY"}]}""", "Gemini withheld the answer (safety)" },
        { "openai", """{"choices":[]}""", "no choices" },
        { "claude", """{"content":[],"stop_reason":"refusal"}""", "Claude refusal, empty content" },
        { "openai", "<html><body>502 Bad Gateway</body></html>", "an HTML error page from a proxy" },
    };

    [Theory]
    [MemberData(nameof(UnexpectedSuccessBodies))]
    public async Task UnexpectedSuccessBody_IsAnAiProviderError(string provider, string body, string _)
    {
        var ai = Service(new Respond(HttpStatusCode.OK, body), provider);

        var ex = await Assert.ThrowsAsync<AiProviderException>(() => ai.GeneralChatAsync([], "hi"));
        Assert.Equal(502, ex.StatusCode);
    }

    [Fact]
    public async Task WithheldAnswer_SaysWhy()
    {
        var ai = Service(new Respond(HttpStatusCode.OK, """{"candidates":[{"finishReason":"SAFETY"}]}"""), "gemini");

        var ex = await Assert.ThrowsAsync<AiProviderException>(() => ai.GeneralChatAsync([], "hi"));
        Assert.Contains("SAFETY", ex.Message);
    }
}
