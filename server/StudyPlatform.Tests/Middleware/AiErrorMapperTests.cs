using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using StudyPlatform.API.Extensions;
using StudyPlatform.Application.Common;
using Xunit;

namespace StudyPlatform.Tests.Middleware;

/// <summary>
/// How AI provider failures reach the client. A streamed call has to fail with the same status a
/// non-streamed one would; a 429 tells the client to back off, a 502 that the provider broke, a 400
/// that the user's own settings are wrong.
/// </summary>
public class AiErrorMapperTests
{
    private sealed class TestController : ControllerBase;

    private static (int Status, string? ErrorCode, string? Message) StreamError(Exception ex)
    {
        var result = new TestController { ControllerContext = new ControllerContext { HttpContext = new DefaultHttpContext() } }
            .AiStreamError(ex);
        var body = Assert.IsType<BaseResponse<string>>(result.Value);
        return (result.StatusCode!.Value, body.ErrorCode, body.Message);
    }

    [Theory]
    [InlineData("openai API returned TooManyRequests: {\"error\":{\"type\":\"rate_limit_exceeded\"}}")]
    [InlineData("gemini API returned 429: RESOURCE_EXHAUSTED")]
    [InlineData("claude API returned Forbidden: You have exceeded your quota")]
    public void RateLimitOrQuota_Is429(string message)
    {
        var (status, code, _) = StreamError(new AiProviderException(message));

        Assert.Equal(429, status);
        Assert.Equal("AI_QUOTA_EXCEEDED", code);
    }

    [Fact]
    public void ProviderServerError_Is502()
    {
        var (status, code, _) = StreamError(new AiProviderException("claude streaming API returned InternalServerError: overloaded"));

        Assert.Equal(502, status);
        Assert.Equal("AI_PROVIDER_ERROR", code);
    }

    [Fact]
    public void MissingProviderSettings_IsTheUsersToFix_Not502()
    {
        var (status, code, message) = StreamError(new UserFacingException("No AI provider specified. Please configure a provider in Settings → AI Services."));

        Assert.Equal(400, status);
        Assert.Equal("INVALID_OPERATION", code);
        Assert.StartsWith("No AI provider specified", message);
    }

    [Fact]
    public void Timeout_KeepsItsOwn504()
    {
        var (status, code, _) = StreamError(new UserFacingException("The AI provider (openai) took longer than 55 seconds to answer.", "AI_TIMEOUT", 504));

        Assert.Equal(504, status);
        Assert.Equal("AI_TIMEOUT", code);
    }

    [Fact]
    public void UnexpectedException_Is502_WithAGenericMessage()
    {
        var (status, code, message) = StreamError(new HttpRequestException("Connection refused (api.internal:443)"));

        Assert.Equal(502, status);
        Assert.Equal("AI_PROVIDER_ERROR", code);
        Assert.DoesNotContain("api.internal", message);
    }

    [Fact]
    public void BadRequestWhoseRequestIdHappensToContain429_IsNotAQuotaError()
    {
        // Provider error bodies carry request ids; matching "429" anywhere in the text used to classify an
        // ordinary rejected request (bad model name) as quota exhaustion, telling the user to wait it out.
        var (status, code, _) = StreamError(new AiProviderException(
            "openai API returned BadRequest: {\"error\":{\"message\":\"The model 'gpt-9' does not exist\",\"request_id\":\"req_7f429ab1\"}}"));

        Assert.Equal(502, status);
        Assert.Equal("AI_PROVIDER_ERROR", code);
    }
}
