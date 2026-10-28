using System.Text.Json;
using FluentValidation;
using FluentValidation.Results;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Logging.Abstractions;
using StudyPlatform.API.Middleware;
using StudyPlatform.Application.Common;
using StudyPlatform.Application.Services;
using StudyPlatform.Domain.Exceptions;
using Xunit;

namespace StudyPlatform.Tests.Middleware;

/// <summary>
/// The status and error code every unhandled failure turns into. Clients branch on these — a 401 starts
/// a token refresh, a 409 a reload, a 429 a "try later" — so the mapping is a contract, not a detail.
/// </summary>
public class GlobalExceptionHandlerMiddlewareTests
{
    private static async Task<(int Status, JsonElement Body, HttpContext Context)> Run(Exception thrown, Action<HttpContext>? arrange = null)
    {
        var context = new DefaultHttpContext { Response = { Body = new MemoryStream() }, TraceIdentifier = "req-1" };
        arrange?.Invoke(context);
        var middleware = new GlobalExceptionHandlerMiddleware(_ => throw thrown, NullLogger<GlobalExceptionHandlerMiddleware>.Instance);

        await middleware.InvokeAsync(context);

        context.Response.Body.Position = 0;
        var text = await new StreamReader(context.Response.Body).ReadToEndAsync();
        var body = text.Length == 0 ? default : JsonDocument.Parse(text).RootElement.Clone();
        return (context.Response.StatusCode, body, context);
    }

    public static TheoryData<Exception, int, string> Mappings => new()
    {
        { new ConcurrencyConflictException(new Exception("db")), 409, "CONCURRENCY_CONFLICT" },
        { new UnauthorizedAccessException("no"), 401, "UNAUTHORIZED" },
        { new KeyNotFoundException("missing"), 404, "NOT_FOUND" },
        { new YouTubeTranscriptUnavailableException("blocked"), 503, "YOUTUBE_TRANSCRIPT_UNAVAILABLE" },
        { new UserFacingException("Pick a provider in Settings.", "NO_PROVIDER", 400), 400, "NO_PROVIDER" },
        { new UserFacingException("The AI provider took too long.", "AI_TIMEOUT", 504), 504, "AI_TIMEOUT" },
        { new AiProviderException("openai API returned TooManyRequests: rate limited"), 429, "AI_QUOTA_EXCEEDED" },
        { new AiProviderException("claude API returned InternalServerError: boom"), 502, "AI_PROVIDER_ERROR" },
        { new InvalidOperationException("Npgsql: password authentication failed for user admin"), 500, "INTERNAL_SERVER_ERROR" },
    };

    [Theory]
    [MemberData(nameof(Mappings))]
    public async Task Exception_MapsToItsStatusAndErrorCode(Exception thrown, int status, string errorCode)
    {
        var (actualStatus, body, _) = await Run(thrown);

        Assert.Equal(status, actualStatus);
        Assert.Equal(errorCode, body.GetProperty("errorCode").GetString());
        Assert.False(body.GetProperty("success").GetBoolean());
        Assert.Equal("req-1", body.GetProperty("requestId").GetString());
    }

    [Fact]
    public async Task UnexpectedException_NeverEchoesItsMessage()
    {
        // An internal message can carry connection strings, SQL or file paths.
        var (_, body, _) = await Run(new InvalidOperationException("Host=db.internal;Password=hunter2"));

        Assert.DoesNotContain("hunter2", body.GetRawText());
        Assert.Equal("An unexpected error occurred.", body.GetProperty("message").GetString());
    }

    [Fact]
    public async Task KeyNotFound_DoesNotEchoTheInternalKey()
    {
        var (_, body, _) = await Run(new KeyNotFoundException("The given key 'tenant-secret-42' was not present"));

        Assert.DoesNotContain("tenant-secret-42", body.GetRawText());
    }

    [Fact]
    public async Task UserFacingException_ReturnsItsOwnMessage()
    {
        var (_, body, _) = await Run(new UserFacingException("Add your API key in Settings.", "NO_KEY", 400));

        Assert.Equal("Add your API key in Settings.", body.GetProperty("message").GetString());
    }

    [Fact]
    public async Task ValidationException_Is400_WithEveryMessage()
    {
        var (status, body, _) = await Run(new ValidationException(
            [new ValidationFailure("Title", "Title is required."), new ValidationFailure("Days", "Days must be 1-365.")]));

        Assert.Equal(400, status);
        Assert.Equal("VALIDATION_ERROR", body.GetProperty("errorCode").GetString());
        Assert.Equal(["Title is required.", "Days must be 1-365."],
            body.GetProperty("errors").EnumerateArray().Select(e => e.GetString()));
    }

    [Fact]
    public async Task ClientThatWentAway_GetsNothingWritten()
    {
        using var aborted = new CancellationTokenSource();
        await aborted.CancelAsync();

        var (status, body, _) = await Run(new OperationCanceledException(), c => c.RequestAborted = aborted.Token);

        Assert.Equal(200, status); // untouched: there is nobody to answer
        Assert.Equal(JsonValueKind.Undefined, body.ValueKind);
    }

    [Fact]
    public async Task CancellationNotCausedByTheClient_IsAServerError()
    {
        // A timeout's cancellation is not the caller leaving; swallowing it would answer 200 with no body.
        var (status, _, _) = await Run(new OperationCanceledException());

        Assert.Equal(500, status);
    }

    [Fact]
    public async Task ResponseAlreadyStarted_IsLeftAlone()
    {
        // Mid-SSE: the status line is gone; the stream carries its own [ERROR] frame.
        var started = new StartedResponseFeature();
        var (status, _, context) = await Run(new InvalidOperationException("late"), c =>
        {
            c.Features.Set<Microsoft.AspNetCore.Http.Features.IHttpResponseFeature>(started);
            c.Response.Body = new MemoryStream();
        });

        Assert.Equal(200, status);
        Assert.Equal(0, context.Response.Body.Length);
    }

    private sealed class StartedResponseFeature : Microsoft.AspNetCore.Http.Features.HttpResponseFeature
    {
        public override bool HasStarted => true;
    }
}
