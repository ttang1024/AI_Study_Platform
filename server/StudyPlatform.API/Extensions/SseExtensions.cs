using System.Text.Json;

namespace StudyPlatform.API.Extensions;

public static class SseExtensions
{
    public static void SetSseHeaders(this HttpResponse response)
    {
        response.ContentType = "text/event-stream";
        response.Headers["Cache-Control"] = "no-cache";
        response.Headers["X-Accel-Buffering"] = "no";
    }

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
