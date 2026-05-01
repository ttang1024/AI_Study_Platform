using System.Diagnostics;
using System.Net;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using StudyPlatform.Application.Services;

namespace StudyPlatform.Infrastructure.Services;

public class YouTubeTranscriptService : IYouTubeTranscriptService
{
    private readonly HttpClient _httpClient;
    private readonly string? _proxyUrl;
    private readonly string? _cookiesBase64;
    private readonly ITranscriptionService _transcriptionService;
    private readonly IMemoryCache _cache;
    private readonly ILogger<YouTubeTranscriptService> _logger;

    public YouTubeTranscriptService(
        HttpClient httpClient,
        IConfiguration configuration,
        ITranscriptionService transcriptionService,
        IMemoryCache cache,
        ILogger<YouTubeTranscriptService> logger)
    {
        _httpClient = httpClient;
        _proxyUrl = configuration["YouTube:ProxyUrl"];
        _cookiesBase64 = configuration["YouTube:CookiesBase64"];
        _transcriptionService = transcriptionService;
        _cache = cache;
        _logger = logger;
    }

    public async Task<IReadOnlyList<TranscriptSegment>?> GetTranscriptAsync(string videoId, CancellationToken cancellationToken = default)
    {
        try
        {
            var raw = await GetRawCaptionsAsync(videoId, cancellationToken);
            if (raw is null || raw.Count == 0)
                return await GetWhisperTranscriptAsync(videoId, cancellationToken);

            return Resegment(raw);
        }
        catch (YouTubeTranscriptUnavailableException ex)
        {
            _logger.LogWarning(ex, "YouTube upstream is unavailable while fetching transcript for video {VideoId}", videoId);
            throw;
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to extract YouTube captions for video {VideoId}; falling back to Whisper", videoId);
            return await GetWhisperTranscriptAsync(videoId, cancellationToken);
        }
    }

    public async Task<IReadOnlyList<TranscriptSegment>?> GetSubtitlesAsync(string videoId, CancellationToken cancellationToken = default)
    {
        try
        {
            var raw = await GetRawCaptionsAsync(videoId, cancellationToken);
            if (raw is null || raw.Count == 0) return null;
            return raw.Select(c => new TranscriptSegment(c.Offset, c.Text)).ToList();
        }
        catch (YouTubeTranscriptUnavailableException ex)
        {
            _logger.LogWarning(ex, "YouTube upstream is unavailable while fetching subtitles for video {VideoId}", videoId);
            throw;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to extract subtitles for video {VideoId}", videoId);
            return null;
        }
    }

    public async Task<IReadOnlyList<PlaylistVideoItem>> GetPlaylistItemsAsync(string playlistId, CancellationToken cancellationToken = default)
    {
        var json = await RunYtDlpAsync([
            "--flat-playlist", "-J", "--no-warnings",
            $"https://www.youtube.com/playlist?list={playlistId}"
        ], cancellationToken);

        using var doc = JsonDocument.Parse(json);
        var results = new List<PlaylistVideoItem>();

        foreach (var entry in doc.RootElement.GetProperty("entries").EnumerateArray())
        {
            if (!entry.TryGetProperty("id", out var idProp)) continue;
            var id = idProp.GetString();
            if (string.IsNullOrEmpty(id)) continue;

            var title = entry.TryGetProperty("title", out var t) ? t.GetString() ?? "" : "";
            var thumbnail = GetBestThumbnail(entry) ?? $"https://img.youtube.com/vi/{id}/mqdefault.jpg";
            results.Add(new PlaylistVideoItem(id, title, thumbnail));
        }

        return results;
    }

    // ── Caption pipeline ─────────────────────────────────────────────────────

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

        var subtitleUrl = FindSubtitleUrl(infoJson);
        if (subtitleUrl is null)
            return null;

        var json3 = await _httpClient.GetStringAsync(subtitleUrl, ct);
        return ParseJson3(json3);
    }

    // Prefer manual subtitles over auto-generated; prefer json3 format for timing data.
    private static string? FindSubtitleUrl(string infoJson)
    {
        using var doc = JsonDocument.Parse(infoJson);
        var root = doc.RootElement;

        foreach (var trackKey in (string[])["subtitles", "automatic_captions"])
        {
            if (!root.TryGetProperty(trackKey, out var tracks)) continue;

            foreach (var lang in tracks.EnumerateObject())
            {
                if (!lang.Name.StartsWith("en", StringComparison.OrdinalIgnoreCase)) continue;

                foreach (var fmt in lang.Value.EnumerateArray())
                {
                    if (fmt.TryGetProperty("ext", out var ext) && ext.GetString() == "json3"
                        && fmt.TryGetProperty("url", out var url))
                        return url.GetString();
                }
            }
        }

        return null;
    }

    private static IReadOnlyList<(TimeSpan Offset, TimeSpan Duration, string Text)> ParseJson3(string json)
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

            var cleaned = CleanCaptionText(sb.ToString());
            if (cleaned.Length > 0)
                result.Add((TimeSpan.FromMilliseconds(startMs), TimeSpan.FromMilliseconds(durationMs), cleaned));
        }

        return result;
    }

    // ── Whisper fallback ──────────────────────────────────────────────────────

    private async Task<IReadOnlyList<TranscriptSegment>?> GetWhisperTranscriptAsync(
        string videoId, CancellationToken ct)
    {
        var cacheKey = $"yt_whisper_transcript:{videoId}";
        if (_cache.TryGetValue(cacheKey, out IReadOnlyList<TranscriptSegment>? cached))
            return cached;

        try
        {
            var (audioData, mimeType) = await DownloadAudioAsync(videoId, ct);
            var transcriptJson = await _transcriptionService.TranscribeAsync(audioData, mimeType, ct);
            var segments = ParseWhisperTranscript(transcriptJson);

            if (segments.Count == 0) return null;

            _cache.Set(cacheKey, segments, TimeSpan.FromMinutes(10));
            return segments;
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Whisper fallback failed for YouTube video {VideoId}", videoId);
            return null;
        }
    }

    private async Task<(byte[] AudioData, string MimeType)> DownloadAudioAsync(string videoId, CancellationToken ct)
    {
        var tempDir = Path.Combine(Path.GetTempPath(), $"yt-{Guid.NewGuid():N}");
        Directory.CreateDirectory(tempDir);
        try
        {
            await RunYtDlpAsync([
                "-x", "--audio-format", "m4a",
                "--no-playlist", "--no-warnings",
                "-o", Path.Combine(tempDir, "%(id)s.%(ext)s"),
                $"https://www.youtube.com/watch?v={videoId}"
            ], ct);

            var audioFile = Directory.GetFiles(tempDir).FirstOrDefault()
                ?? throw new InvalidOperationException($"yt-dlp produced no audio file for {videoId}");

            return (await File.ReadAllBytesAsync(audioFile, ct), "audio/mp4");
        }
        finally
        {
            if (Directory.Exists(tempDir))
                Directory.Delete(tempDir, recursive: true);
        }
    }

    // ── yt-dlp subprocess ─────────────────────────────────────────────────────

    private async Task<string> RunYtDlpAsync(IEnumerable<string> args, CancellationToken ct)
    {
        // Write cookies to a temp file for this invocation so the path is never
        // shared across concurrent requests and is always cleaned up.
        string? cookieFile = null;
        if (!string.IsNullOrWhiteSpace(_cookiesBase64))
        {
            var cookieBytes = TryDecodeCookies(_cookiesBase64);
            if (cookieBytes is { Length: > 0 })
            {
                cookieFile = Path.GetTempFileName();
                await File.WriteAllBytesAsync(cookieFile, cookieBytes, ct);
            }
        }

        try
        {
            using var process = new Process();
            process.StartInfo = new ProcessStartInfo
            {
                FileName = "yt-dlp",
                RedirectStandardOutput = true,
                RedirectStandardError = true,
                UseShellExecute = false,
                CreateNoWindow = true,
            };

            foreach (var arg in args)
                process.StartInfo.ArgumentList.Add(arg);

            if (!string.IsNullOrWhiteSpace(_proxyUrl))
            {
                process.StartInfo.ArgumentList.Add("--proxy");
                process.StartInfo.ArgumentList.Add(_proxyUrl);
            }

            if (cookieFile != null)
            {
                process.StartInfo.ArgumentList.Add("--cookies");
                process.StartInfo.ArgumentList.Add(cookieFile);
            }

            process.Start();

            var stdoutTask = process.StandardOutput.ReadToEndAsync(ct);
            var stderrTask = process.StandardError.ReadToEndAsync(ct);
            await process.WaitForExitAsync(ct);

            var stdout = await stdoutTask;
            var stderr = await stderrTask;

            if (process.ExitCode != 0)
                throw new InvalidOperationException($"yt-dlp exited {process.ExitCode}: {stderr.Trim()}");

            return stdout;
        }
        finally
        {
            if (cookieFile != null && File.Exists(cookieFile))
                File.Delete(cookieFile);
        }
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private byte[]? TryDecodeCookies(string cookiesBase64)
    {
        var cleanedBase64 = Regex.Replace(cookiesBase64, @"\s+", "");
        if (cleanedBase64.StartsWith("secretref:", StringComparison.OrdinalIgnoreCase))
        {
            _logger.LogError(
                "YouTube:CookiesBase64 is configured as a literal Container Apps secret reference. " +
                "Resolve the secret reference in deployment or set the value to base64-encoded cookies.txt content.");
            return null;
        }

        try
        {
            return Convert.FromBase64String(cleanedBase64);
        }
        catch (FormatException ex)
        {
            _logger.LogError(ex, "YouTube:CookiesBase64 is not valid base64; continuing without YouTube cookies.");
            return null;
        }
    }

    private static bool IsConnectivityFailure(Exception ex, CancellationToken ct)
    {
        if (ct.IsCancellationRequested) return false;
        return ex is TaskCanceledException or TimeoutException
            || ex.InnerException is TaskCanceledException or TimeoutException;
    }

    private static string? GetBestThumbnail(JsonElement entry)
    {
        if (!entry.TryGetProperty("thumbnails", out var thumbnails)) return null;
        string? best = null;
        var bestWidth = 0;
        foreach (var t in thumbnails.EnumerateArray())
        {
            var url = t.TryGetProperty("url", out var u) ? u.GetString() : null;
            var width = t.TryGetProperty("width", out var w) ? w.GetInt32() : 0;
            if (url != null && width > bestWidth) { best = url; bestWidth = width; }
        }
        return best;
    }

    private static string CleanCaptionText(string text)
    {
        text = WebUtility.HtmlDecode(text);
        text = text.Replace('\n', ' ').Replace('\r', ' ');
        text = Regex.Replace(text, @"\s+", " ");
        return text.Trim();
    }

    private static IReadOnlyList<TranscriptSegment> ParseWhisperTranscript(string transcriptJson)
    {
        var chunks = JsonSerializer.Deserialize<List<WhisperTranscriptChunk>>(transcriptJson, new JsonSerializerOptions
        {
            PropertyNameCaseInsensitive = true
        });

        return chunks?
            .Where(c => !string.IsNullOrWhiteSpace(c.Text))
            .Select(c => new TranscriptSegment(TimeSpan.FromSeconds(c.Start), c.Text.Trim()))
            .ToList()
            ?? [];
    }

    private sealed record WhisperTranscriptChunk(double Start, double End, string Text);

    // ── Phase 1: merge caption lines into complete sentences ─────────────
    // A new sentence begins when the accumulated text ends with . ! ?
    // OR there is a silence gap > 2 s between consecutive captions,
    // OR the accumulated time reaches 30 s (fallback for subtitle-only tracks
    // that have no punctuation and no gaps).
    // ── Phase 2: group sentences into 30-60 second segments ──────────────
    // A new segment is emitted once the accumulated duration >= 30 s
    // (always at a sentence boundary). A segment is force-closed at 60 s.
    private static IReadOnlyList<TranscriptSegment> Resegment(
        IReadOnlyList<(TimeSpan Offset, TimeSpan Duration, string Text)> captions)
    {
        // ── Phase 1 ──────────────────────────────────────────────────────
        var sentences = new List<(TimeSpan Start, string Text)>();
        var sentStart = captions[0].Offset;
        var sb = new StringBuilder();

        for (int i = 0; i < captions.Count; i++)
        {
            var (offset, duration, text) = captions[i];

            if (sb.Length == 0) sentStart = offset;
            else sb.Append(' ');
            sb.Append(text);

            var current = sb.ToString().TrimEnd();
            bool sentenceEnd = current.EndsWith('.') || current.EndsWith('!') || current.EndsWith('?');

            bool silenceGap = i < captions.Count - 1
                && (captions[i + 1].Offset - (offset + duration)).TotalSeconds > 2.0;

            bool lastCaption = i == captions.Count - 1;

            bool timeBreak = (offset - sentStart).TotalSeconds >= 30.0;

            if (sentenceEnd || silenceGap || lastCaption || timeBreak)
            {
                if (current.Length > 0)
                    sentences.Add((sentStart, current));
                sb.Clear();
            }
        }

        if (sentences.Count == 0) return [];

        // ── Phase 2: time-based segmentation (30-60 s) ───────────────────
        const double minSegmentSeconds = 30.0;
        const double maxSegmentSeconds = 60.0;

        var result = new List<TranscriptSegment>();
        var segStart = sentences[0].Start;
        var segSb = new StringBuilder();

        for (int i = 0; i < sentences.Count; i++)
        {
            var (start, text) = sentences[i];
            if (segSb.Length == 0) segStart = start;
            if (segSb.Length > 0) segSb.Append(' ');
            segSb.Append(text);

            bool isLast = i == sentences.Count - 1;

            double nextStartSec = isLast
                ? start.TotalSeconds + 5.0
                : sentences[i + 1].Start.TotalSeconds;
            double segDuration = nextStartSec - segStart.TotalSeconds;

            if (segDuration >= minSegmentSeconds || segDuration >= maxSegmentSeconds || isLast)
            {
                result.Add(new TranscriptSegment(segStart, segSb.ToString().Trim()));
                segSb.Clear();
            }
        }

        return result;
    }
}
