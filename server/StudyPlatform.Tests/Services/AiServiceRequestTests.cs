using System.Net;
using System.Text;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using Moq;
using StudyPlatform.Application.Services;
using StudyPlatform.Application.Settings;
using StudyPlatform.Infrastructure.Services;
using Xunit;

namespace StudyPlatform.Tests.Services;

/// <summary>Provider keys belong in headers, never in a URL that proxies and HTTP clients log.</summary>
public class AiServiceRequestTests
{
    private sealed class Capture(string body) : HttpMessageHandler
    {
        public HttpRequestMessage? Request { get; private set; }

        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
        {
            Request = request;
            return Task.FromResult(new HttpResponseMessage(HttpStatusCode.OK)
            {
                Content = new StringContent(body, Encoding.UTF8, "application/json"),
            });
        }
    }

    private static AiService Service(HttpMessageHandler handler, IHttpContextAccessor accessor) => new(
        new HttpClient(handler),
        NullLogger<AiService>.Instance,
        accessor,
        Mock.Of<IAppCache>(),
        Options.Create(new CacheOptions()),
        Mock.Of<IAiUsageRecorder>(),
        Options.Create(new AiRequestOptions()));

    [Fact]
    public async Task Gemini_KeyGoesInAHeader_AndTheModelIsEscaped()
    {
        var handler = new Capture("""{"candidates":[{"content":{"parts":[{"text":"OK"}]}}]}""");
        var accessor = AiTestCredentials.Accessor("gemini", "gemini/../evil?x=1", "AIza-secret");

        Assert.Equal("OK", await Service(handler, accessor).TestConnectionAsync());

        var request = handler.Request!;
        Assert.DoesNotContain("AIza-secret", request.RequestUri!.ToString());
        Assert.Equal("AIza-secret", request.Headers.GetValues("x-goog-api-key").Single());
        Assert.Equal("generativelanguage.googleapis.com", request.RequestUri.Host);
        Assert.Contains("gemini%2F..%2Fevil%3Fx%3D1:generateContent", request.RequestUri.AbsoluteUri);
    }

    [Fact]
    public async Task OpenAiCompatible_UsesBearerAuth()
    {
        var handler = new Capture("""{"choices":[{"message":{"content":"OK"}}]}""");
        var accessor = AiTestCredentials.Accessor("openai", "gpt-4o-mini", "sk-secret");

        await Service(handler, accessor).TestConnectionAsync();

        Assert.Equal("https://api.openai.com/v1/chat/completions", handler.Request!.RequestUri!.ToString());
        Assert.Equal("Bearer", handler.Request.Headers.Authorization!.Scheme);
    }
}
