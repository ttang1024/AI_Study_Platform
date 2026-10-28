using System.Text;
using System.Text.Json;
using Microsoft.AspNetCore.Mvc;
using StudyPlatform.Application.Common;

namespace StudyPlatform.API.Extensions;

public static class SseExtensions
{
    public static void SetSseHeaders(this HttpResponse response)
    {
        response.ContentType = "text/event-stream";
        response.Headers["Cache-Control"] = "no-cache";
        response.Headers["X-Accel-Buffering"] = "no";
    }

    /// <summary>
    /// Emits an already-computed (e.g. cached) value as a single SSE message followed by [DONE].
    /// </summary>
    public static async Task<IActionResult> WriteSseCachedAsync(this ControllerBase controller, string value, CancellationToken cancellationToken)
    {
        controller.Response.SetSseHeaders();
        await controller.Response.WriteSseDataAsync(value, cancellationToken);
        await controller.Response.WriteSseDoneAsync(cancellationToken);
        return new EmptyResult();
    }

    /// <summary>
    /// Pipes a streamed AI token sequence to the client as SSE. Handles the shared boilerplate:
    /// probing the first chunk (so provider errors map to a proper HTTP status before headers are
    /// written), setting SSE headers, accumulating the full text, surfacing mid-stream errors as an
    /// <c>[ERROR]</c> event, and terminating with <c>[DONE]</c>.
    /// </summary>
    /// <param name="beforeStream">
    /// Optional work to run once the first chunk has arrived but before any bytes are flushed
    /// (e.g. persisting the user's message). Skipped if the stream is empty or errors on probe.
    /// </param>
    /// <param name="onCompleted">
    /// Optional work to run with the fully accumulated text once streaming finishes successfully and
    /// produced non-empty output (e.g. caching or persisting the result). Runs even if the viewer has
    /// just disconnected: the answer is complete and already paid for.
    /// </param>
    /// <param name="onInterrupted">
    /// Optional work to run, with whatever text arrived, when the stream stops early after
    /// <paramref name="beforeStream"/> ran — the viewer disconnected or the provider failed. For work
    /// <paramref name="beforeStream"/> started that must not be left half-done (a chat's user turn).
    /// </param>
    public static async Task<IActionResult> StreamAiToSseAsync(
        this ControllerBase controller,
        IAsyncEnumerable<string> stream,
        CancellationToken cancellationToken,
        Func<CancellationToken, Task>? beforeStream = null,
        Func<string, CancellationToken, Task>? onCompleted = null,
        Func<string, CancellationToken, Task>? onInterrupted = null)
    {
        var response = controller.Response;
        await using var enumerator = stream.GetAsyncEnumerator(cancellationToken);

        string firstChunk;
        try
        {
            if (!await enumerator.MoveNextAsync())
                return new NoContentResult();

            firstChunk = enumerator.Current;
        }
        catch (OperationCanceledException)
        {
            return new EmptyResult();
        }
        catch (Exception ex)
        {
            return controller.AiStreamError(ex);
        }

        if (beforeStream != null)
            await beforeStream(cancellationToken);

        response.SetSseHeaders();

        var fullText = new StringBuilder();
        try
        {
            fullText.Append(firstChunk);
            await response.WriteSseDataAsync(firstChunk, cancellationToken);

            while (await enumerator.MoveNextAsync())
            {
                var chunk = enumerator.Current;
                fullText.Append(chunk);
                await response.WriteSseDataAsync(chunk, cancellationToken);
            }

            if (fullText.Length > 0 && onCompleted != null)
                await onCompleted(fullText.ToString(), CancellationToken.None);
        }
        catch (OperationCanceledException)
        {
            await RunInterruptedAsync(controller, onInterrupted, fullText);
            return new EmptyResult();
        }
        catch (Exception ex)
        {
            controller.HttpContext.RequestServices.GetService<ILoggerFactory>()
                ?.CreateLogger("SseStreaming").LogError(ex, "AI stream failed mid-response");
            await RunInterruptedAsync(controller, onInterrupted, fullText);
            await response.WriteSseDataAsync(
                "[ERROR] " + ClientErrors.MessageFor(ex, "The AI response was interrupted. Please try again."),
                cancellationToken);
        }

        await response.WriteSseDoneAsync(cancellationToken);
        return new EmptyResult();
    }

    private static async Task RunInterruptedAsync(
        ControllerBase controller, Func<string, CancellationToken, Task>? onInterrupted, StringBuilder fullText)
    {
        if (onInterrupted == null)
            return;
        try
        {
            // The request token is already cancelled when the viewer left; this write is ours, not theirs.
            await onInterrupted(fullText.ToString(), CancellationToken.None);
        }
        catch (Exception ex)
        {
            controller.HttpContext.RequestServices.GetService<ILoggerFactory>()
                ?.CreateLogger("SseStreaming").LogError(ex, "Could not record an interrupted AI stream");
        }
    }

    /// <summary>Writes an <see cref="AiTextStream"/>: its cached text in one event, or the live stream.</summary>
    public static Task<IActionResult> WriteAiTextStreamAsync(this ControllerBase controller, AiTextStream result, CancellationToken cancellationToken)
        => result.Cached is { } cached
            ? controller.WriteSseCachedAsync(cached, cancellationToken)
            : controller.StreamAiToSseAsync(result.Stream!, cancellationToken, onCompleted: result.OnCompleted);

    public static async Task WriteSseDataAsync(this HttpResponse response, string data, CancellationToken cancellationToken)
    {
        await response.WriteAsync($"data: {JsonSerializer.Serialize(data)}\n\n", cancellationToken);
        await response.Body.FlushAsync(cancellationToken);
    }

    public static async Task WriteSseDoneAsync(this HttpResponse response, CancellationToken cancellationToken)
    {
        await response.WriteAsync("data: [DONE]\n\n", cancellationToken);
        await response.Body.FlushAsync(cancellationToken);
    }
}
