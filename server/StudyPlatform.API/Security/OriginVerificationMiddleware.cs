using System.Security.Cryptography;
using System.Text;

namespace StudyPlatform.API.Security;

/// <summary>
/// Rejects requests that did not come through CloudFront.
///
/// <para>The origin host is publicly resolvable, so without this anyone could skip CloudFront and talk to
/// the API directly — forging X-Forwarded-For (and with it the rate-limit identity) as they please.
/// CloudFront is configured to add <see cref="HeaderName"/> with a shared secret to every origin request;
/// when <c>Api:OriginVerifySecret</c> is set, a request without it is refused. Unset (local dev, tests,
/// docker-compose) it is a no-op. <c>/health</c> stays open so the deploy script and container probes
/// can reach the process on localhost.</para>
/// </summary>
public sealed class OriginVerificationMiddleware
{
    public const string HeaderName = "X-Origin-Verify";

    private readonly RequestDelegate _next;
    private readonly byte[]? _secret;

    public OriginVerificationMiddleware(RequestDelegate next, IConfiguration configuration)
    {
        _next = next;
        var secret = configuration["Api:OriginVerifySecret"];
        _secret = string.IsNullOrWhiteSpace(secret) ? null : Encoding.UTF8.GetBytes(secret);
    }

    public Task InvokeAsync(HttpContext context)
    {
        if (_secret == null || context.Request.Path.StartsWithSegments("/health"))
            return _next(context);

        var presented = Encoding.UTF8.GetBytes(context.Request.Headers[HeaderName].ToString());
        if (!CryptographicOperations.FixedTimeEquals(presented, _secret))
        {
            context.Response.StatusCode = StatusCodes.Status403Forbidden;
            return Task.CompletedTask;
        }

        // Never let the secret travel further than this check (logs, downstream handlers).
        context.Request.Headers.Remove(HeaderName);
        return _next(context);
    }
}
