using System.Text;
using System.Text.Json;
using Microsoft.AspNetCore.Mvc;

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
    /// produced non-empty output (e.g. caching or persisting the result).
    /// </param>
    public static async Task<IActionResult> StreamAiToSseAsync(
        this ControllerBase controller,
        IAsyncEnumerable<string> stream,
        CancellationToken cancellationToken,
        Func<CancellationToken, Task>? beforeStream = null,
        Func<string, CancellationToken, Task>? onCompleted = null)
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
                await onCompleted(fullText.ToString(), cancellationToken);
        }
        catch (OperationCanceledException)
        {
            return new EmptyResult();
        }
        catch (Exception ex)
        {
            await response.WriteSseDataAsync("[ERROR] " + ex.Message, cancellationToken);
        }

        await response.WriteSseDoneAsync(cancellationToken);
        return new EmptyResult();
    }

    public static async Task WriteSseDataAsync(this HttpResponse response, string data, CancellationToken cancellationToken)
    {
        await response.WriteAsync($"data: {JsonSerializer.Serialize(data)}\n\n", cancellationToken);
        await response.Body.FlushAsync(cancellationToken);
    }

    /// <summary>
    /// Emits an object as the SSE payload. Distinct from WriteSseDataAsync, which serializes its
    /// argument as a JSON *string* — passing pre-serialized JSON to that would double-encode it.
    /// </summary>
    public static async Task WriteSseJsonAsync<T>(this HttpResponse response, T payload, CancellationToken cancellationToken)
    {
        var json = JsonSerializer.Serialize(payload, new JsonSerializerOptions
        {
            PropertyNamingPolicy = JsonNamingPolicy.CamelCase
        });

        await response.WriteAsync($"data: {json}\n\n", cancellationToken);
        await response.Body.FlushAsync(cancellationToken);
    }

    public static async Task WriteSseDoneAsync(this HttpResponse response, CancellationToken cancellationToken)
    {
        await response.WriteAsync("data: [DONE]\n\n", cancellationToken);
        await response.Body.FlushAsync(cancellationToken);
    }
}
