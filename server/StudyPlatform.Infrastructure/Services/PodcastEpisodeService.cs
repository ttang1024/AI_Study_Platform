using System.Net;
using System.Text.Json;
using System.Text.RegularExpressions;
using System.Web;
using System.Xml;
using System.Xml.Linq;
using StudyPlatform.Application.Services;

namespace StudyPlatform.Infrastructure.Services;

/// <summary>
/// Multi-source podcast episode resolver.
/// Apple Podcasts links resolve through the iTunes lookup API; direct audio-file URLs
/// pass straight through; any other episode page (Overcast, Castro, Pocket Casts,
/// Podbean, Buzzsprout, Libsyn, Simplecast, Transistor, …) is fetched and the audio
/// URL extracted from og:audio / twitter:player:stream / JSON-LD / &lt;audio&gt; tags,
/// so new platforms usually work with no code change.
/// </summary>
public class PodcastEpisodeService : IPodcastEpisodeService
{
    private static readonly string[] AudioExtensions =
        [".mp3", ".m4a", ".m4b", ".aac", ".ogg", ".oga", ".opus", ".wav", ".flac"];

    private readonly HttpClient _httpClient;

    public PodcastEpisodeService(HttpClient httpClient)
    {
        _httpClient = httpClient;
    }

    public async Task<PodcastEpisodeInfo?> GetEpisodeInfoAsync(string episodeUrl, CancellationToken cancellationToken = default)
    {
        try
        {
            var uri = new Uri(episodeUrl.Trim());
            if (uri.Scheme != Uri.UriSchemeHttp && uri.Scheme != Uri.UriSchemeHttps) return null;

            if (uri.Host.EndsWith("podcasts.apple.com", StringComparison.OrdinalIgnoreCase))
                return await GetAppleEpisodeAsync(uri, cancellationToken);

            if (IsDirectAudioUrl(uri))
            {
                var name = Path.GetFileNameWithoutExtension(uri.AbsolutePath);
                var title = string.IsNullOrWhiteSpace(name) ? uri.Host : WebUtility.UrlDecode(name).Replace('-', ' ').Replace('_', ' ');
                return new PodcastEpisodeInfo(title, uri.Host, uri.AbsoluteUri, "", "", 0);
            }

            return await GetEpisodeFromPageAsync(uri, cancellationToken);
        }
        catch
        {
            return null;
        }
    }

    public async Task<PodcastFeedInfo?> GetFeedAsync(string feedUrl, CancellationToken cancellationToken = default)
    {
        try
        {
            var uri = new Uri(feedUrl.Trim());
            if (uri.Scheme != Uri.UriSchemeHttp && uri.Scheme != Uri.UriSchemeHttps) return null;

            var response = await _httpClient.GetAsync(uri, cancellationToken);
            response.EnsureSuccessStatusCode();
            var xml = await response.Content.ReadAsStringAsync(cancellationToken);
            return ParseFeed(xml);
        }
        catch
        {
            return null;
        }
    }

    public async Task<(byte[] AudioData, string MimeType)?> DownloadAudioAsync(string audioUrl, CancellationToken cancellationToken = default)
    {
        try
        {
            var response = await _httpClient.GetAsync(audioUrl, cancellationToken);
            response.EnsureSuccessStatusCode();
            var mimeType = response.Content.Headers.ContentType?.MediaType ?? "audio/mpeg";
            var bytes = await response.Content.ReadAsByteArrayAsync(cancellationToken);
            return (bytes, mimeType);
        }
        catch
        {
            return null;
        }
    }

    private static bool IsDirectAudioUrl(Uri uri)
    {
        var ext = Path.GetExtension(uri.AbsolutePath).ToLowerInvariant();
        return AudioExtensions.Contains(ext);
    }

    // ---------------------------------------------------------------- Apple

    private async Task<PodcastEpisodeInfo?> GetAppleEpisodeAsync(Uri uri, CancellationToken cancellationToken)
    {
        // Extract podcast ID from path segment like "id123456789"
        var segments = uri.AbsolutePath.Split('/', StringSplitOptions.RemoveEmptyEntries);
        var podcastIdSegment = segments.LastOrDefault(s =>
            s.StartsWith("id", StringComparison.OrdinalIgnoreCase) && long.TryParse(s[2..], out _));
        if (podcastIdSegment == null) return null;
        var podcastId = podcastIdSegment[2..];

        // Extract episode ID from query string (?i=XXXXX)
        var queryParams = HttpUtility.ParseQueryString(uri.Query);
        var episodeIdStr = queryParams["i"];
        if (!long.TryParse(episodeIdStr, out var episodeTrackId)) return null;

        // Fetch episodes from iTunes API
        var itunesUrl = $"https://itunes.apple.com/lookup?id={podcastId}&entity=podcastEpisode&limit=300";
        var response = await _httpClient.GetAsync(itunesUrl, cancellationToken);
        response.EnsureSuccessStatusCode();

        using var stream = await response.Content.ReadAsStreamAsync(cancellationToken);
        using var doc = await JsonDocument.ParseAsync(stream, cancellationToken: cancellationToken);

        var results = doc.RootElement.GetProperty("results");

        // First result is the podcast show itself
        string showName = "";
        string showThumbnail = "";
        if (results.GetArrayLength() > 0)
        {
            var show = results[0];
            showName = show.TryGetProperty("collectionName", out var cn) ? cn.GetString() ?? "" : "";
            showThumbnail = show.TryGetProperty("artworkUrl600", out var art) ? art.GetString() ?? "" : "";
        }

        // Find the specific episode by trackId
        foreach (var result in results.EnumerateArray())
        {
            if (!result.TryGetProperty("trackId", out var trackIdProp)) continue;
            if (trackIdProp.GetInt64() != episodeTrackId) continue;

            var title = result.TryGetProperty("trackName", out var tn) ? tn.GetString() ?? "" : "";
            var description = result.TryGetProperty("description", out var desc) ? desc.GetString() ?? "" : "";

            // episodeUrl is the direct audio URL; fall back to previewUrl
            var audioUrl = result.TryGetProperty("episodeUrl", out var eu) ? eu.GetString() ?? "" : "";
            if (string.IsNullOrEmpty(audioUrl))
                audioUrl = result.TryGetProperty("previewUrl", out var pu) ? pu.GetString() ?? "" : "";

            var thumbnail = result.TryGetProperty("artworkUrl600", out var epArt)
                ? epArt.GetString() ?? ""
                : "";
            if (string.IsNullOrEmpty(thumbnail)) thumbnail = showThumbnail;

            var durationMs = result.TryGetProperty("trackTimeMillis", out var dur) ? dur.GetInt32() : 0;

            if (string.IsNullOrEmpty(audioUrl)) return null;

            return new PodcastEpisodeInfo(title, showName, audioUrl, thumbnail, description, durationMs);
        }

        return null;
    }

    // ------------------------------------------------------- RSS feeds

    private static readonly XNamespace ItunesNs = "http://www.itunes.com/dtds/podcast-1.0.dtd";

    /// <summary>An XML document whose root is &lt;rss&gt; or an Atom &lt;feed&gt; is a feed, not an episode page.</summary>
    private static bool LooksLikeXmlFeed(string content)
    {
        var head = content.AsSpan(0, Math.Min(content.Length, 2048)).TrimStart();
        if (head.StartsWith("<?xml", StringComparison.OrdinalIgnoreCase))
            return head.Contains("<rss", StringComparison.OrdinalIgnoreCase)
                || head.Contains("<feed", StringComparison.OrdinalIgnoreCase);
        return head.StartsWith("<rss", StringComparison.OrdinalIgnoreCase);
    }

    private static PodcastFeedInfo? ParseFeed(string xml)
    {
        var doc = XDocument.Parse(xml.TrimStart('﻿'));
        var channel = doc.Root?.Element("channel");
        if (channel == null) return null; // RSS 2.0 only — podcast feeds are universally RSS with enclosures

        var feedTitle = channel.Element("title")?.Value.Trim() ?? "";
        var feedThumbnail = channel.Element(ItunesNs + "image")?.Attribute("href")?.Value
            ?? channel.Element("image")?.Element("url")?.Value ?? "";

        var episodes = new List<PodcastFeedEpisode>();
        foreach (var item in channel.Elements("item"))
        {
            var enclosure = item.Elements("enclosure").FirstOrDefault(e =>
                (e.Attribute("type")?.Value.StartsWith("audio/") ?? true) &&
                !string.IsNullOrWhiteSpace(e.Attribute("url")?.Value));
            var audioUrl = enclosure?.Attribute("url")?.Value.Trim();
            if (string.IsNullOrEmpty(audioUrl)) continue;

            var guid = item.Element("guid")?.Value.Trim();
            var title = item.Element("title")?.Value.Trim()
                ?? item.Element(ItunesNs + "title")?.Value.Trim() ?? "";
            var link = item.Element("link")?.Value.Trim() ?? "";
            var description = item.Element(ItunesNs + "summary")?.Value.Trim()
                ?? item.Element("description")?.Value.Trim() ?? "";
            var thumbnail = item.Element(ItunesNs + "image")?.Attribute("href")?.Value ?? feedThumbnail;

            DateTime? publishedAt = null;
            if (DateTime.TryParse(item.Element("pubDate")?.Value, System.Globalization.CultureInfo.InvariantCulture,
                    System.Globalization.DateTimeStyles.AdjustToUniversal, out var pub))
                publishedAt = pub;

            episodes.Add(new PodcastFeedEpisode(
                string.IsNullOrEmpty(guid) ? audioUrl : guid,
                title, audioUrl, link, StripHtml(description), thumbnail,
                ParseItunesDurationMs(item.Element(ItunesNs + "duration")?.Value), publishedAt));

            if (episodes.Count >= 200) break;
        }

        return episodes.Count > 0 ? new PodcastFeedInfo(feedTitle, feedThumbnail, episodes) : null;
    }

    /// <summary>itunes:duration is either plain seconds ("3720") or clock format ("1:02:00" / "62:00").</summary>
    private static int ParseItunesDurationMs(string? value)
    {
        if (string.IsNullOrWhiteSpace(value)) return 0;
        value = value.Trim();
        if (int.TryParse(value, out var seconds)) return seconds * 1000;
        var parts = value.Split(':');
        if (parts.Length is < 2 or > 3 || !parts.All(p => int.TryParse(p, out _))) return 0;
        var nums = parts.Select(int.Parse).ToArray();
        var total = parts.Length == 3
            ? nums[0] * 3600 + nums[1] * 60 + nums[2]
            : nums[0] * 60 + nums[1];
        return total * 1000;
    }

    private static string StripHtml(string value) =>
        WebUtility.HtmlDecode(Regex.Replace(value, "<[^>]+>", " ")).Trim();

    // ---------------------------------------------- generic episode pages

    private async Task<PodcastEpisodeInfo?> GetEpisodeFromPageAsync(Uri pageUri, CancellationToken cancellationToken)
    {
        var response = await _httpClient.GetAsync(pageUri, cancellationToken);
        response.EnsureSuccessStatusCode();
        var html = await response.Content.ReadAsStringAsync(cancellationToken);
        // Feeds must go through GetFeedAsync — the raw-URL fallback below would otherwise
        // silently grab the newest episode's enclosure.
        if (LooksLikeXmlFeed(html)) return null;
        // Follow client-side redirects only implicitly: use the final request URI as base for relative links.
        var baseUri = response.RequestMessage?.RequestUri ?? pageUri;

        var audioUrl = ExtractAudioUrl(html, baseUri);
        if (string.IsNullOrEmpty(audioUrl)) return null;

        var title = MetaContent(html, "og:title") ?? TitleTag(html) ?? baseUri.Host;
        var showName = JsonLdSeriesName(html) ?? MetaContent(html, "og:site_name") ?? "";
        var thumbnail = MetaContent(html, "og:image") ?? "";
        var description = MetaContent(html, "og:description") ?? MetaContent(html, "description") ?? "";
        var durationMs = ExtractDurationMs(html);

        return new PodcastEpisodeInfo(title, showName, audioUrl, thumbnail, description, durationMs);
    }

    private static string? ExtractAudioUrl(string html, Uri baseUri)
    {
        // 1. Open Graph / Twitter audio metadata (Podbean, Buzzsprout, Libsyn, Overcast, …)
        foreach (var key in new[] { "og:audio:secure_url", "og:audio:url", "og:audio", "twitter:player:stream" })
        {
            var url = NormalizeAudioUrl(MetaContent(html, key), baseUri);
            if (url != null) return url;
        }

        // 2. JSON-LD PodcastEpisode/AudioObject contentUrl (Castro, Simplecast, Transistor, …)
        foreach (Match m in Regex.Matches(html, "\"contentUrl\"\\s*:\\s*\"([^\"]+)\"", RegexOptions.IgnoreCase))
        {
            var url = NormalizeAudioUrl(m.Groups[1].Value, baseUri, requireAudioExtension: true);
            if (url != null) return url;
        }

        // 3. <audio src> / <audio><source src> tags
        foreach (Match m in Regex.Matches(html,
                     "<(?:audio|source)[^>]+src\\s*=\\s*[\"']([^\"']+)[\"']", RegexOptions.IgnoreCase))
        {
            var url = NormalizeAudioUrl(m.Groups[1].Value, baseUri);
            if (url != null) return url;
        }

        // 4. Last resort: any absolute audio-file URL embedded in scripts/JSON
        var raw = Regex.Match(html,
            @"https?:(?:\\/\\/|//)[^\s""'<>\\]+\.(?:mp3|m4a|aac|ogg|opus)(?:\?[^\s""'<>\\]*)?",
            RegexOptions.IgnoreCase);
        return raw.Success ? NormalizeAudioUrl(raw.Value, baseUri) : null;
    }

    private static string? NormalizeAudioUrl(string? candidate, Uri baseUri, bool requireAudioExtension = false)
    {
        if (string.IsNullOrWhiteSpace(candidate)) return null;
        var cleaned = WebUtility.HtmlDecode(candidate).Replace("\\/", "/").Trim();
        if (!Uri.TryCreate(baseUri, cleaned, out var uri)) return null;
        if (uri.Scheme != Uri.UriSchemeHttp && uri.Scheme != Uri.UriSchemeHttps) return null;
        if (requireAudioExtension && !AudioExtensions.Contains(Path.GetExtension(uri.AbsolutePath).ToLowerInvariant()))
            return null;
        return uri.AbsoluteUri;
    }

    private static string? MetaContent(string html, string key)
    {
        // Match both attribute orders: property/name before content and vice versa.
        var patterns = new[]
        {
            $"<meta[^>]+(?:property|name)\\s*=\\s*[\"']{Regex.Escape(key)}[\"'][^>]*content\\s*=\\s*[\"']([^\"']+)[\"']",
            $"<meta[^>]+content\\s*=\\s*[\"']([^\"']+)[\"'][^>]*(?:property|name)\\s*=\\s*[\"']{Regex.Escape(key)}[\"']",
        };
        foreach (var pattern in patterns)
        {
            var m = Regex.Match(html, pattern, RegexOptions.IgnoreCase);
            if (m.Success) return WebUtility.HtmlDecode(m.Groups[1].Value).Trim();
        }
        return null;
    }

    private static string? TitleTag(string html)
    {
        var m = Regex.Match(html, "<title[^>]*>([^<]+)</title>", RegexOptions.IgnoreCase);
        return m.Success ? WebUtility.HtmlDecode(m.Groups[1].Value).Trim() : null;
    }

    private static string? JsonLdSeriesName(string html)
    {
        var m = Regex.Match(html, "\"partOfSeries\"\\s*:\\s*\\{[^{}]*\"name\"\\s*:\\s*\"([^\"]+)\"", RegexOptions.IgnoreCase);
        return m.Success ? WebUtility.HtmlDecode(Regex.Unescape(m.Groups[1].Value)).Trim() : null;
    }

    private static int ExtractDurationMs(string html)
    {
        // JSON-LD ISO 8601 duration, e.g. "duration":"PT1H2M3S"
        var m = Regex.Match(html, "\"duration\"\\s*:\\s*\"(P[^\"]+)\"", RegexOptions.IgnoreCase);
        if (m.Success)
        {
            try { return (int)XmlConvert.ToTimeSpan(m.Groups[1].Value).TotalMilliseconds; }
            catch { /* malformed duration — fall through */ }
        }
        return 0;
    }
}
