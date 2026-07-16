using System.Text.Json;
using Microsoft.Extensions.Diagnostics.HealthChecks;

namespace StudyPlatform.API.HealthChecks;

/// <summary>
/// Renders the readiness result as JSON. The default writer emits the bare status word, which tells an
/// operator that something is wrong but not which dependency — the first thing they need to know.
/// Exception details are deliberately omitted: this endpoint is unauthenticated.
/// </summary>
public static class HealthCheckResponse
{
    public static Task WriteAsync(HttpContext context, HealthReport report)
    {
        context.Response.ContentType = "application/json";

        var payload = new
        {
            status = report.Status.ToString(),
            durationMs = report.TotalDuration.TotalMilliseconds,
            checks = report.Entries.Select(e => new
            {
                name = e.Key,
                status = e.Value.Status.ToString(),
                description = e.Value.Description,
                durationMs = e.Value.Duration.TotalMilliseconds,
            }),
        };

        return context.Response.WriteAsync(
            JsonSerializer.Serialize(payload, new JsonSerializerOptions(JsonSerializerDefaults.Web)));
    }
}
