using System.Runtime.CompilerServices;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.DependencyInjection;
using StudyPlatform.API.Extensions;
using StudyPlatform.Application.Common;
using Xunit;

namespace StudyPlatform.Tests.Middleware;

/// <summary>What gets persisted when an AI stream ends early or the viewer leaves.</summary>
public class SseStreamingTests
{
    private sealed class TestController : ControllerBase;

    private static TestController Controller() => new()
    {
        ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext
            {
                RequestServices = new ServiceCollection().AddLogging().BuildServiceProvider(),
                Response = { Body = new MemoryStream() },
            },
        },
    };

    private static async IAsyncEnumerable<string> Chunks(
        CancellationTokenSource? cancelAfterSecond = null, Exception? failAfterSecond = null,
        [EnumeratorCancellation] CancellationToken ct = default)
    {
        yield return "Hel";
        await Task.Yield();
        yield return "lo";
        if (cancelAfterSecond != null)
        {
            // The viewer closes the tab: the request token fires while the provider is mid-answer.
            await cancelAfterSecond.CancelAsync();
            ct.ThrowIfCancellationRequested();
        }
        if (failAfterSecond != null)
            throw failAfterSecond;
    }

    [Fact]
    public async Task ViewerDisconnectingMidAnswer_RecordsTheInterruptedReply_NotTheCompletion()
    {
        using var request = new CancellationTokenSource();
        string? completed = null, interrupted = null;

        await Controller().StreamAiToSseAsync(Chunks(request, ct: request.Token), request.Token,
            beforeStream: _ => Task.CompletedTask,
            onCompleted: (text, _) => { completed = text; return Task.CompletedTask; },
            onInterrupted: (text, ct) => { Assert.False(ct.IsCancellationRequested); interrupted = text; return Task.CompletedTask; });

        Assert.Null(completed);
        Assert.Equal("Hello", interrupted);
    }

    [Fact]
    public async Task ProviderFailingMidAnswer_RecordsTheInterruptedReply()
    {
        string? interrupted = null;

        await Controller().StreamAiToSseAsync(Chunks(failAfterSecond: new InvalidOperationException("boom")), default,
            beforeStream: _ => Task.CompletedTask,
            onInterrupted: (text, _) => { interrupted = text; return Task.CompletedTask; });

        Assert.Equal("Hello", interrupted);
    }

    [Fact]
    public async Task FinishedAnswer_IsPersistedOnAToken_TheDisconnectCannotCancel()
    {
        using var request = new CancellationTokenSource();
        CancellationToken persistedWith = default;

        await Controller().StreamAiToSseAsync(Chunks(), request.Token,
            onCompleted: (_, ct) => { persistedWith = ct; return Task.CompletedTask; });

        Assert.False(persistedWith.CanBeCanceled);
    }

    private static async IAsyncEnumerable<string> From(params string[] chunks)
    {
        foreach (var chunk in chunks)
        {
            await Task.Yield();
            yield return chunk;
        }
    }

    private static async IAsyncEnumerable<string> FailsFirst(Exception ex)
    {
        await Task.Yield();
        throw ex;
#pragma warning disable CS0162
        yield break;
#pragma warning restore CS0162
    }

    private static string Body(ControllerBase controller)
    {
        var stream = (MemoryStream)controller.Response.Body;
        return System.Text.Encoding.UTF8.GetString(stream.ToArray());
    }

    [Fact]
    public async Task SuccessfulStream_FramesEveryChunk_AndEndsWithDone()
    {
        var controller = Controller();

        await controller.StreamAiToSseAsync(From("Hel", "lo"), default);

        Assert.Equal("text/event-stream", controller.Response.ContentType);
        Assert.Equal("data: \"Hel\"\n\ndata: \"lo\"\n\ndata: [DONE]\n\n", Body(controller));
    }

    [Fact]
    public async Task ChunkContainingFrameSyntax_CannotForgeAFrame()
    {
        // Model output is untrusted text; written raw, a chunk with a blank line and "data: [DONE]" would
        // end the stream early on the client. Each chunk is JSON-encoded into a single data line.
        var controller = Controller();

        await controller.StreamAiToSseAsync(From("a\n\ndata: [DONE]\n\nb"), default);

        var frames = Body(controller).Split("\n\n", StringSplitOptions.RemoveEmptyEntries);
        Assert.Equal(2, frames.Length);
        Assert.Equal("data: [DONE]", frames[1]);
    }

    [Fact]
    public async Task EmptyStream_Is204_WithoutSseHeaders()
    {
        var controller = Controller();

        var result = await controller.StreamAiToSseAsync(From(), default);

        Assert.IsType<NoContentResult>(result);
        Assert.NotEqual("text/event-stream", controller.Response.ContentType);
    }

    [Fact]
    public async Task FailureBeforeTheFirstChunk_IsAProperHttpError_NotAStream()
    {
        // Probing the first chunk is what lets a quota error be a real 429 instead of a 200 stream with
        // an error buried in it.
        var controller = Controller();
        var persisted = false;

        var result = await controller.StreamAiToSseAsync(
            FailsFirst(new AiProviderException("openai streaming API returned TooManyRequests: slow down")), default,
            beforeStream: _ => { persisted = true; return Task.CompletedTask; });

        var error = Assert.IsType<ObjectResult>(result);
        Assert.Equal(429, error.StatusCode);
        Assert.False(persisted); // the user turn is not recorded for a request that never started
        Assert.Equal(0, Body(controller).Length);
    }

    [Fact]
    public async Task ViewerLeavingBeforeTheFirstChunk_WritesNothing()
    {
        using var request = new CancellationTokenSource();
        await request.CancelAsync();
        var controller = Controller();

        var result = await controller.StreamAiToSseAsync(FailsFirst(new OperationCanceledException(request.Token)), request.Token);

        Assert.IsType<EmptyResult>(result);
        Assert.Equal(0, Body(controller).Length);
    }

    [Fact]
    public async Task FailureMidStream_SendsAnErrorFrame_ThenDone()
    {
        var controller = Controller();

        await controller.StreamAiToSseAsync(Chunks(failAfterSecond: new InvalidOperationException("socket reset at 10.0.0.5")), default);

        var body = Body(controller);
        Assert.Contains("data: \"[ERROR] The AI response was interrupted. Please try again.\"", body);
        Assert.EndsWith("data: [DONE]\n\n", body);
        Assert.DoesNotContain("10.0.0.5", body); // internal detail stays in the log
    }

    [Fact]
    public async Task CachedResult_IsOneFrameAndDone()
    {
        var controller = Controller();

        await controller.WriteSseCachedAsync("# cached summary", default);

        Assert.Equal("data: \"# cached summary\"\n\ndata: [DONE]\n\n", Body(controller));
    }

    [Fact]
    public void InterruptedReply_MarksPartialText_AndCoversAnEmptyOne()
    {
        Assert.EndsWith("_(Response interrupted.)_", ChatThreads.InterruptedReply("Half an answer"));
        Assert.StartsWith("Half an answer", ChatThreads.InterruptedReply("Half an answer"));
        Assert.False(string.IsNullOrWhiteSpace(ChatThreads.InterruptedReply("")));
    }
}
