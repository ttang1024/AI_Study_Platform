using Microsoft.AspNetCore.Http;
using StudyPlatform.Application.Services;

namespace StudyPlatform.Infrastructure.Services;

/// <inheritdoc cref="IRequestContext"/>
public class HttpRequestContext : IRequestContext
{
    private readonly IHttpContextAccessor _httpContextAccessor;

    public HttpRequestContext(IHttpContextAccessor httpContextAccessor)
    {
        _httpContextAccessor = httpContextAccessor;
    }

    private HttpContext? Http => _httpContextAccessor.HttpContext;

    public string? UserAgent => Truncate(Http?.Request.Headers.UserAgent.ToString(), 512);

    /// <inheritdoc cref="AuditLogger"/>
    public string? IpAddress
    {
        get
        {
            var http = Http;
            if (http == null)
                return null;

            // Behind a load balancer the socket address is the balancer, so the forwarded chain is
            // the only thing carrying the client. Spoofable, and recorded for display only.
            var forwarded = http.Request.Headers["X-Forwarded-For"].ToString();
            if (!string.IsNullOrWhiteSpace(forwarded))
                return Truncate(forwarded.Split(',')[0].Trim(), 64);

            return Truncate(http.Connection.RemoteIpAddress?.ToString(), 64);
        }
    }

    public string? DeviceName => DescribeDevice(UserAgent);

    /// <summary>
    /// Names the browser and OS from a user-agent string.
    ///
    /// <para>Deliberately a handful of substring checks rather than a UA-parsing dependency. The
    /// output is a label in a session list, so the cost of guessing wrong is that a row reads
    /// "Unknown device" — not worth a library that needs a regularly refreshed pattern database.
    /// Order matters: every Chromium browser also says "Chrome", and Edge and Chrome both say
    /// "Safari", so the more specific brands have to be tested first.</para>
    /// </summary>
    internal static string? DescribeDevice(string? userAgent)
    {
        if (string.IsNullOrWhiteSpace(userAgent))
            return null;

        var browser =
            userAgent.Contains("Edg/", StringComparison.OrdinalIgnoreCase) ? "Edge" :
            userAgent.Contains("OPR/", StringComparison.OrdinalIgnoreCase) ? "Opera" :
            userAgent.Contains("Firefox", StringComparison.OrdinalIgnoreCase) ? "Firefox" :
            userAgent.Contains("Chrome", StringComparison.OrdinalIgnoreCase) ? "Chrome" :
            userAgent.Contains("Safari", StringComparison.OrdinalIgnoreCase) ? "Safari" :
            userAgent.Contains("Expo", StringComparison.OrdinalIgnoreCase) ? "Mobile app" :
            null;

        var os =
            userAgent.Contains("iPhone", StringComparison.OrdinalIgnoreCase) ? "iPhone" :
            userAgent.Contains("iPad", StringComparison.OrdinalIgnoreCase) ? "iPad" :
            userAgent.Contains("Android", StringComparison.OrdinalIgnoreCase) ? "Android" :
            userAgent.Contains("Mac OS X", StringComparison.OrdinalIgnoreCase) ? "macOS" :
            userAgent.Contains("Windows", StringComparison.OrdinalIgnoreCase) ? "Windows" :
            userAgent.Contains("Linux", StringComparison.OrdinalIgnoreCase) ? "Linux" :
            null;

        return (browser, os) switch
        {
            (null, null) => "Unknown device",
            (not null, null) => browser,
            (null, not null) => os,
            _ => $"{browser} on {os}",
        };
    }

    private static string? Truncate(string? value, int maxLength)
    {
        if (string.IsNullOrWhiteSpace(value))
            return null;
        return value.Length <= maxLength ? value : value[..maxLength];
    }
}
