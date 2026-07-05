using System.Globalization;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Logging;
using StudyPlatform.Application.Services;

namespace StudyPlatform.Infrastructure.Services;

// YouTube caption retrieval: timedtext fetch, subtitle-track discovery & json3 parsing.
public partial class YouTubeTranscriptService
{
    private async Task<IReadOnlyList<(TimeSpan Offset, TimeSpan Duration, string Text)>?> GetRawCaptionsAsync(
        string videoId, CancellationToken ct)
    {
        var cacheKey = $"yt_captions:{videoId}";
        var failureCacheKey = $"yt_captions_unavailable:{videoId}";

        if (_cache.TryGetValue(failureCacheKey, out _))
            throw new YouTubeTranscriptUnavailableException(videoId);

        if (_cache.TryGetValue(cacheKey, out IReadOnlyList<(TimeSpan, TimeSpan, string)>? cached))
            return cached;

        try
        {
            var raw = await FetchCaptionsAsync(videoId, ct);
            if (raw is null || raw.Count == 0)
                return null;

            _cache.Set(cacheKey, (IReadOnlyList<(TimeSpan, TimeSpan, string)>)raw, TimeSpan.FromMinutes(10));
            return raw;
        }
        catch (YouTubeTranscriptUnavailableException)
        {
            _cache.Set(failureCacheKey, true, TimeSpan.FromMinutes(2));
            throw;
        }
    }

    private async Task<IReadOnlyList<(TimeSpan Offset, TimeSpan Duration, string Text)>?> GetRawCaptionsFromUrlAsync(
        string videoUrl, CancellationToken ct)
    {
        var cacheKey = $"video_captions:{videoUrl}";
        if (_cache.TryGetValue(cacheKey, out IReadOnlyList<(TimeSpan, TimeSpan, string)>? cached))
            return cached;

        if (IsBilibiliUrl(videoUrl))
        {
            var bilibiliRaw = await GetBilibiliCaptionsAsync(videoUrl, ct);
            if (bilibiliRaw is { Count: > 0 })
            {
                _cache.Set(cacheKey, bilibiliRaw, TimeSpan.FromMinutes(10));
                return bilibiliRaw;
            }
            _logger.LogInformation("Bilibili API returned no subtitles for {VideoUrl}; falling back to yt-dlp", videoUrl);
        }

        var preferSimplifiedChinese = IsBilibiliUrl(videoUrl);
        string infoJson;
        try
        {
            infoJson = await RunYtDlpAsync(["-J", "--no-playlist", "--no-warnings", videoUrl], ct);
        }
        catch (Exception ex) when (IsConnectivityFailure(ex, ct))
        {
            _logger.LogWarning(ex, "yt-dlp timed out fetching captions for video URL {VideoUrl}", videoUrl);
            throw;
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "yt-dlp caption fetch failed for video URL {VideoUrl}", videoUrl);
            return null;
        }

        foreach (var track in FindSubtitleTracks(infoJson, preferSimplifiedChinese))
        {
            try
            {
                var payload = await _httpClient.GetStringAsync(track.Url, ct);
                var raw = track.Ext == "json3"
                    ? ParseJson3(payload, preferSimplifiedChinese)
                    : ParseVtt(payload, preferSimplifiedChinese);
                if (raw.Count == 0) continue;

                _cache.Set(cacheKey, raw, TimeSpan.FromMinutes(10));
                return raw;
            }
            catch (Exception ex) when (ex is HttpRequestException or JsonException)
            {
                _logger.LogWarning(ex, "Failed to parse subtitle track for video URL {VideoUrl}", videoUrl);
            }
        }

        return null;
    }

    private async Task<IReadOnlyList<(TimeSpan Offset, TimeSpan Duration, string Text)>?> FetchCaptionsAsync(
        string videoId, CancellationToken ct)
    {
        string infoJson;
        try
        {
            infoJson = await RunYtDlpAsync([
                "-J", "--no-playlist", "--no-warnings",
                $"https://www.youtube.com/watch?v={videoId}"
            ], ct);
        }
        catch (Exception ex) when (IsConnectivityFailure(ex, ct))
        {
            _logger.LogWarning(ex, "yt-dlp timed out fetching captions for video {VideoId}", videoId);
            throw new YouTubeTranscriptUnavailableException(videoId, ex);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "yt-dlp caption fetch failed for video {VideoId}", videoId);
            return null;
        }

        foreach (var track in FindSubtitleTracks(infoJson, preferSimplifiedChinese: false))
        {
            try
            {
                var payload = await _httpClient.GetStringAsync(track.Url, ct);
                var raw = track.Ext == "json3" ? ParseJson3(payload) : ParseVtt(payload);
                if (raw.Count > 0)
                    return raw;
            }
            catch (Exception ex) when (ex is HttpRequestException or JsonException)
            {
                _logger.LogWarning(ex, "Failed to parse subtitle track for video {VideoId}", videoId);
            }
        }

        return null;
    }

    // Prefer manual subtitles over auto-generated, original tracks over translations,
    // and English when available. json3 (YouTube) carries timing data without extra parsing;
    // vtt covers the other yt-dlp-supported sites (Vimeo, TED, Dailymotion, …).
    private static IReadOnlyList<SubtitleCandidate> FindSubtitleTracks(string infoJson, bool preferSimplifiedChinese)
    {
        using var doc = JsonDocument.Parse(infoJson);
        var root = doc.RootElement;
        var candidates = new List<SubtitleCandidate>();

        foreach (var trackKey in (string[])["subtitles", "automatic_captions"])
        {
            if (!root.TryGetProperty(trackKey, out var tracks)) continue;
            var trackPriority = trackKey == "subtitles" ? 0 : 1;

            foreach (var lang in tracks.EnumerateObject())
            {
                foreach (var fmt in lang.Value.EnumerateArray())
                {
                    if (!fmt.TryGetProperty("ext", out var ext) || !fmt.TryGetProperty("url", out var url))
                        continue;
                    var extValue = ext.GetString();
                    if (extValue is not ("json3" or "vtt"))
                        continue;
                    var value = url.GetString();
                    if (!string.IsNullOrWhiteSpace(value))
                        candidates.Add(new SubtitleCandidate(trackPriority, lang.Name, value, extValue));
                }
            }
        }

        return candidates
            .OrderBy(c => c.TrackPriority)
            .ThenBy(c => c.IsTranslated ? 1 : 0)
            .ThenBy(c => c.GetLanguagePriority(preferSimplifiedChinese))
            .ThenBy(c => c.Ext == "json3" ? 0 : 1)
            .ToList();
    }

    private sealed record SubtitleCandidate(int TrackPriority, string Language, string Url, string Ext)
    {
        public bool IsTranslated => Url.Contains("tlang=", StringComparison.OrdinalIgnoreCase);

        public int GetLanguagePriority(bool preferSimplifiedChinese)
        {
            if (preferSimplifiedChinese)
            {
                if (Language.Equals("zh-Hans", StringComparison.OrdinalIgnoreCase)
                    || Language.Equals("zh-CN", StringComparison.OrdinalIgnoreCase)
                    || Language.Equals("zh-SG", StringComparison.OrdinalIgnoreCase)
                    || Language.Equals("chi_sim", StringComparison.OrdinalIgnoreCase))
                    return 0;

                if (Language.Equals("zh", StringComparison.OrdinalIgnoreCase)
                    || Language.StartsWith("zh-", StringComparison.OrdinalIgnoreCase))
                    return 1;

                if (Language.Equals("en", StringComparison.OrdinalIgnoreCase)
                    || Language.StartsWith("en", StringComparison.OrdinalIgnoreCase))
                    return 2;

                return 3;
            }

            return Language.Equals("en", StringComparison.OrdinalIgnoreCase)
                ? 0
                : Language.StartsWith("en", StringComparison.OrdinalIgnoreCase) ? 1 : 2;
        }
    }

    private static IReadOnlyList<(TimeSpan Offset, TimeSpan Duration, string Text)> ParseJson3(
        string json,
        bool normalizeSimplifiedChinese = false)
    {
        using var doc = JsonDocument.Parse(json);
        var result = new List<(TimeSpan, TimeSpan, string)>();

        foreach (var ev in doc.RootElement.GetProperty("events").EnumerateArray())
        {
            if (!ev.TryGetProperty("segs", out var segs)) continue;

            var startMs = ev.GetProperty("tStartMs").GetInt64();
            var durationMs = ev.TryGetProperty("dDurationMs", out var d) ? d.GetInt64() : 0L;

            var sb = new StringBuilder();
            foreach (var seg in segs.EnumerateArray())
            {
                if (seg.TryGetProperty("utf8", out var text))
                    sb.Append(text.GetString());
            }

            var cleaned = TranscriptTextProcessor.CleanCaptionText(sb.ToString());
            if (normalizeSimplifiedChinese)
                cleaned = ToSimplifiedChinese(cleaned);
            if (cleaned.Length > 0)
                result.Add((TimeSpan.FromMilliseconds(startMs), TimeSpan.FromMilliseconds(durationMs), cleaned));
        }

        return result;
    }

    private static readonly Regex VttTimingRegex = new(
        @"(?<start>(?:\d{1,2}:)?\d{1,2}:\d{2}\.\d{3})\s+-->\s+(?<end>(?:\d{1,2}:)?\d{1,2}:\d{2}\.\d{3})",
        RegexOptions.Compiled);

    // WebVTT parser for non-YouTube subtitle tracks (Vimeo, TED, Dailymotion, …).
    private static IReadOnlyList<(TimeSpan Offset, TimeSpan Duration, string Text)> ParseVtt(
        string vtt,
        bool normalizeSimplifiedChinese = false)
    {
        var result = new List<(TimeSpan, TimeSpan, string)>();
        var lines = vtt.Split('\n');

        for (var i = 0; i < lines.Length; i++)
        {
            var match = VttTimingRegex.Match(lines[i]);
            if (!match.Success) continue;

            var start = ParseVttTimestamp(match.Groups["start"].Value);
            var end = ParseVttTimestamp(match.Groups["end"].Value);

            var sb = new StringBuilder();
            for (i++; i < lines.Length; i++)
            {
                var line = lines[i].TrimEnd('\r');
                if (string.IsNullOrWhiteSpace(line)) break;
                if (VttTimingRegex.IsMatch(line)) { i--; break; }
                if (sb.Length > 0) sb.Append(' ');
                sb.Append(line);
            }

            var text = Regex.Replace(sb.ToString(), "<[^>]+>", "");
            text = TranscriptTextProcessor.CleanCaptionText(text);
            if (normalizeSimplifiedChinese)
                text = ToSimplifiedChinese(text);
            if (text.Length == 0) continue;

            // Rolling captions repeat the previous cue's text; drop consecutive duplicates.
            if (result.Count > 0 && result[^1].Item3 == text) continue;

            result.Add((start, end > start ? end - start : TimeSpan.Zero, text));
        }

        return result;
    }

    private static TimeSpan ParseVttTimestamp(string value)
    {
        var parts = value.Split(':');
        var seconds = double.Parse(parts[^1], CultureInfo.InvariantCulture);
        var minutes = int.Parse(parts[^2], CultureInfo.InvariantCulture);
        var hours = parts.Length >= 3 ? int.Parse(parts[^3], CultureInfo.InvariantCulture) : 0;
        return TimeSpan.FromHours(hours) + TimeSpan.FromMinutes(minutes) + TimeSpan.FromSeconds(seconds);
    }

    // ── Whisper fallback ──────────────────────────────────────────────────────

}
