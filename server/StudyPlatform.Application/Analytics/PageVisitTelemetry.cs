using System.Text;

namespace StudyPlatform.Application.Analytics;

/// <summary>
/// Turns what a browser reports about a page view into the three small, aggregatable values a
/// visit row keeps. Pure functions, deliberately: the client is untrusted, so the server decides
/// what a path, a referrer and a device are — and each rule is unit-testable on its own.
/// </summary>
public static class PageVisitTelemetry
{
    /// <summary>Longest path we store; the column matches.</summary>
    public const int MaxPathLength = 200;

    private const int MaxSegments = 6;

    /// <summary>
    /// Collapses a URL path to the route pattern behind it: query and fragment dropped, identifying
    /// segments replaced by a placeholder, case folded.
    ///
    /// <para>This is what keeps the table free of content identifiers — "/documents/&lt;guid&gt;"
    /// aggregates as "/documents/:id", and the segment after "/share" is always masked because a
    /// share token is a credential regardless of how short it is.</para>
    /// </summary>
    public static string NormalizePath(string? rawPath)
    {
        if (string.IsNullOrWhiteSpace(rawPath))
            return "/";

        var path = rawPath.Trim();

        // An absolute URL is not what the client should send, but accepting one costs a line.
        // Scheme-gated on purpose: on Unix, Uri treats a leading "/" as a file path and would turn
        // "/library?type=videos" into a file:// URI whose AbsolutePath still carries the query.
        if ((path.StartsWith("http://", StringComparison.OrdinalIgnoreCase)
             || path.StartsWith("https://", StringComparison.OrdinalIgnoreCase))
            && Uri.TryCreate(path, UriKind.Absolute, out var absolute))
            path = absolute.AbsolutePath;

        var cut = path.IndexOfAny(new[] { '?', '#' });
        if (cut >= 0)
            path = path[..cut];

        var segments = path.Split('/', StringSplitOptions.RemoveEmptyEntries);
        if (segments.Length == 0)
            return "/";

        var builder = new StringBuilder();
        var previous = string.Empty;

        foreach (var raw in segments.Take(MaxSegments))
        {
            var segment = raw.ToLowerInvariant();
            string rendered;

            if (previous == "share")
                rendered = ":token";
            else if (LooksLikeIdentifier(segment))
                rendered = ":id";
            else
                rendered = Truncate(segment, 40);

            builder.Append('/').Append(rendered);
            previous = segment;
        }

        var result = builder.ToString();
        return result.Length > MaxPathLength ? result[..MaxPathLength] : result;
    }

    /// <summary>
    /// Reduces a referrer to its host, and drops it when the visitor simply came from another page
    /// of this site — internal navigation is already a visit row of its own.
    /// </summary>
    public static string? NormalizeReferrer(string? referrer, string? selfHost)
    {
        if (string.IsNullOrWhiteSpace(referrer))
            return null;

        if (!Uri.TryCreate(referrer.Trim(), UriKind.Absolute, out var uri))
            return null;

        var host = uri.Host.ToLowerInvariant();
        if (host.Length == 0)
            return null;

        if (!string.IsNullOrWhiteSpace(selfHost))
        {
            // The Host header carries a port; the referrer's host does not.
            var self = selfHost.Split(':')[0].ToLowerInvariant();
            if (host == self)
                return null;
        }

        return Truncate(host, 200);
    }

    /// <summary>"mobile" | "tablet" | "desktop" | "unknown" from a User-Agent string.</summary>
    public static string ClassifyDevice(string? userAgent)
    {
        if (string.IsNullOrWhiteSpace(userAgent))
            return "unknown";

        var ua = userAgent.ToLowerInvariant();

        if (ua.Contains("ipad") || ua.Contains("tablet") || ua.Contains("kindle") ||
            ua.Contains("silk") || ua.Contains("playbook") ||
            // Android reports "mobile" only on phones; an Android without it is a tablet.
            (ua.Contains("android") && !ua.Contains("mobile")))
            return "tablet";

        if (ua.Contains("mobi") || ua.Contains("iphone") || ua.Contains("ipod") ||
            ua.Contains("android") || ua.Contains("windows phone") || ua.Contains("blackberry"))
            return "mobile";

        return "desktop";
    }

    private static readonly string[] BotMarkers =
    {
        "bot", "crawl", "spider", "slurp", "facebookexternalhit", "embedly", "quora link preview",
        "whatsapp", "telegrambot", "discordbot", "preview", "headless", "lighthouse", "pagespeed",
        "monitor", "pingdom", "uptime", "curl/", "wget", "python-requests", "httpclient",
        "go-http-client", "axios", "postman", "scrapy", "phantomjs", "puppeteer", "playwright",
    };

    /// <summary>
    /// Whether the User-Agent is something other than a person looking at the page. Crawlers hit
    /// the landing page and every share link constantly, and counting them makes the whole
    /// dashboard a lie, so those visits are dropped rather than stored and filtered later.
    /// </summary>
    public static bool IsBot(string? userAgent)
    {
        if (string.IsNullOrWhiteSpace(userAgent))
            return false;

        var ua = userAgent.ToLowerInvariant();
        return BotMarkers.Any(marker => ua.Contains(marker));
    }

    /// <summary>
    /// A segment that identifies one thing rather than naming a route: a GUID, a numeric id, or a
    /// long opaque token. Route names in this app are words, so the test can stay this blunt.
    /// </summary>
    private static bool LooksLikeIdentifier(string segment)
    {
        if (segment.Length == 0)
            return false;

        if (Guid.TryParse(segment, out _))
            return true;

        if (segment.All(char.IsAsciiDigit))
            return true;

        // Opaque tokens (share links, object keys) are long and mix digits in; route names do not.
        return segment.Length >= 16 && segment.Any(char.IsAsciiDigit);
    }

    private static string Truncate(string value, int max) => value.Length <= max ? value : value[..max];
}
