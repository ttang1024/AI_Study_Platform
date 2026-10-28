using System.Diagnostics;

namespace StudyPlatform.API.Middleware;

public class RequestLoggingMiddleware
{
    private readonly RequestDelegate _next;
    private readonly ILogger<RequestLoggingMiddleware> _logger;

    public RequestLoggingMiddleware(RequestDelegate next, ILogger<RequestLoggingMiddleware> logger)
    {
        _next = next;
        _logger = logger;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        var stopwatch = Stopwatch.StartNew();
        var requestId = Guid.NewGuid().ToString("N")[..8];

        // One id across everything this request logs (handlers, AI calls, EF) and on the response, so a
        // user's error report can be traced to its log lines — they used to share nothing but a timestamp.
        context.TraceIdentifier = requestId;
        context.Response.Headers["X-Request-Id"] = requestId;
        using var scope = _logger.BeginScope(new Dictionary<string, object> { ["RequestId"] = requestId });

        _logger.LogInformation(
            "[{RequestId}] {Method} {Path}{QueryString} started",
            requestId,
            context.Request.Method,
            context.Request.Path,
            RedactQueryString(context.Request.Query));

        try
        {
            await _next(context);
        }
        finally
        {
            stopwatch.Stop();
            _logger.LogInformation(
                "[{RequestId}] {Method} {Path} responded {StatusCode} in {ElapsedMs}ms",
                requestId,
                context.Request.Method,
                context.Request.Path,
                context.Response.StatusCode,
                stopwatch.ElapsedMilliseconds);
        }
    }

    // Credentials that ride in the query string because the client cannot set a header: the access
    // token on <video>/<img> sources and the SignalR handshake, OAuth codes. Logged verbatim they would
    // sit in CloudWatch as working bearer tokens.
    private static readonly HashSet<string> SensitiveQueryKeys = new(StringComparer.OrdinalIgnoreCase)
    {
        "access_token", "refresh_token", "token", "key", "api_key", "code", "password",
    };

    internal static string RedactQueryString(IQueryCollection query)
    {
        if (query.Count == 0)
            return string.Empty;

        var parts = query.SelectMany(pair => SensitiveQueryKeys.Contains(pair.Key)
            ? [$"{Uri.EscapeDataString(pair.Key)}=[REDACTED]"]
            : pair.Value.Select(v => $"{Uri.EscapeDataString(pair.Key)}={Uri.EscapeDataString(v ?? string.Empty)}"));
        return "?" + string.Join("&", parts);
    }
}
