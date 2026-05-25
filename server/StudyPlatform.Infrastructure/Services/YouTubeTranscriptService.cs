using System.Diagnostics;
using System.Net;
using System.Security.Cryptography;
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
    private readonly YouTubeCredentialPool _pool;
    private readonly ITranscriptionService _transcriptionService;
    private readonly IMemoryCache _cache;
    private readonly ILogger<YouTubeTranscriptService> _logger;

    // How many proxy+cookie combinations to try before giving up.
    private const int MaxYtDlpAttempts = 5;

    public YouTubeTranscriptService(
        HttpClient httpClient,
        YouTubeCredentialPool pool,
        ITranscriptionService transcriptionService,
        IMemoryCache cache,
        ILogger<YouTubeTranscriptService> logger)
    {
        _httpClient = httpClient;
        _pool = pool;
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

    public async Task<IReadOnlyList<TranscriptSegment>?> GetTranscriptFromUrlAsync(string videoUrl, CancellationToken cancellationToken = default)
    {
        try
        {
            var raw = await GetRawCaptionsFromUrlAsync(videoUrl, cancellationToken);
            if (raw is null || raw.Count == 0)
                return await GetWhisperTranscriptFromUrlAsync(videoUrl, cancellationToken);

            return Resegment(raw);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to extract captions for video URL {VideoUrl}; falling back to Whisper", videoUrl);
            return await GetWhisperTranscriptFromUrlAsync(videoUrl, cancellationToken);
        }
    }

    public async Task<IReadOnlyList<TranscriptSegment>?> GetSubtitlesFromUrlAsync(string videoUrl, CancellationToken cancellationToken = default)
    {
        try
        {
            var raw = await GetRawCaptionsFromUrlAsync(videoUrl, cancellationToken);
            if (raw is null || raw.Count == 0)
                return null;

            return IsBilibiliUrl(videoUrl)
                ? Resegment(raw)
                : raw.Select(c => new TranscriptSegment(c.Offset, c.Text)).ToList();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to extract subtitles for video URL {VideoUrl}", videoUrl);
            return null;
        }
    }

    public async Task<VideoMetadata?> GetVideoMetadataAsync(string videoUrl, CancellationToken cancellationToken = default)
    {
        if (IsBilibiliUrl(videoUrl))
        {
            var (bvid, _) = ParseBilibiliUrl(videoUrl);
            if (bvid == null) return null;
            var viewData = await GetBilibiliViewAsync(bvid, cancellationToken);
            if (viewData == null) return null;
            return new VideoMetadata(viewData.Title, viewData.Pic);
        }

        try
        {
            var json = await RunYtDlpAsync(["-J", "--no-playlist", "--no-warnings", videoUrl], cancellationToken);
            using var doc = JsonDocument.Parse(json);
            var root = doc.RootElement;

            var title = root.TryGetProperty("title", out var t) ? t.GetString() ?? "" : "";
            var thumbnail = GetBestThumbnail(root);
            if (string.IsNullOrEmpty(thumbnail) && root.TryGetProperty("thumbnail", out var th))
                thumbnail = th.GetString();

            return new VideoMetadata(title, thumbnail ?? "");
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to fetch video metadata for {VideoUrl}", videoUrl);
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

    public async Task<IReadOnlyList<PlaylistVideoItem>> GetBilibiliVideoItemsAsync(string videoUrl, CancellationToken cancellationToken = default)
    {
        var (bvid, _) = ParseBilibiliUrl(videoUrl);
        if (bvid == null) return [];

        var viewData = await GetBilibiliViewAsync(bvid, cancellationToken);
        if (viewData == null) return [];

        if (viewData.Pages.Count == 0)
            return [new PlaylistVideoItem(bvid, viewData.Title, viewData.Pic)];

        return viewData.Pages
            .OrderBy(p => p.PageNumber)
            .Select(p =>
            {
                var videoId = p.PageNumber > 1 ? $"{bvid}:p{p.PageNumber}" : bvid;
                var pageTitle = string.IsNullOrWhiteSpace(p.Part)
                    ? viewData.Title
                    : viewData.Pages.Count == 1
                        ? p.Part
                        : $"P{p.PageNumber} {p.Part}";
                return new PlaylistVideoItem(videoId, pageTitle, viewData.Pic);
            })
            .ToList();
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

        foreach (var subtitleUrl in FindSubtitleUrls(infoJson, preferSimplifiedChinese))
        {
            try
            {
                var json3 = await _httpClient.GetStringAsync(subtitleUrl, ct);
                var raw = ParseJson3(json3, preferSimplifiedChinese);
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

        foreach (var subtitleUrl in FindSubtitleUrls(infoJson, preferSimplifiedChinese: false))
        {
            try
            {
                var json3 = await _httpClient.GetStringAsync(subtitleUrl, ct);
                var raw = ParseJson3(json3);
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
    // and English when available. json3 carries timing data without extra parsing.
    private static IReadOnlyList<string> FindSubtitleUrls(string infoJson, bool preferSimplifiedChinese)
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
                    if (fmt.TryGetProperty("ext", out var ext) && ext.GetString() == "json3"
                        && fmt.TryGetProperty("url", out var url))
                    {
                        var value = url.GetString();
                        if (!string.IsNullOrWhiteSpace(value))
                            candidates.Add(new SubtitleCandidate(trackPriority, lang.Name, value));
                    }
                }
            }
        }

        return candidates
            .OrderBy(c => c.TrackPriority)
            .ThenBy(c => c.IsTranslated ? 1 : 0)
            .ThenBy(c => c.GetLanguagePriority(preferSimplifiedChinese))
            .Select(c => c.Url)
            .ToList();
    }

    private sealed record SubtitleCandidate(int TrackPriority, string Language, string Url)
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

            var cleaned = CleanCaptionText(sb.ToString());
            if (normalizeSimplifiedChinese)
                cleaned = ToSimplifiedChinese(cleaned);
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

    private async Task<IReadOnlyList<TranscriptSegment>?> GetWhisperTranscriptFromUrlAsync(
        string videoUrl, CancellationToken ct)
    {
        var cacheKey = $"video_whisper_transcript:{videoUrl}";
        if (_cache.TryGetValue(cacheKey, out IReadOnlyList<TranscriptSegment>? cached))
            return cached;

        try
        {
            var (audioData, mimeType) = await DownloadAudioFromUrlAsync(videoUrl, ct);
            var transcriptJson = await _transcriptionService.TranscribeAsync(audioData, mimeType, ct);
            var segments = ParseWhisperTranscript(transcriptJson);
            if (IsBilibiliUrl(videoUrl))
                segments = segments
                    .Select(s => new TranscriptSegment(s.Start, ToSimplifiedChinese(s.Text)))
                    .ToList();

            if (segments.Count == 0) return null;

            _cache.Set(cacheKey, segments, TimeSpan.FromMinutes(10));
            return segments;
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Whisper fallback failed for video URL {VideoUrl}", videoUrl);
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

    private async Task<(byte[] AudioData, string MimeType)> DownloadAudioFromUrlAsync(string videoUrl, CancellationToken ct)
    {
        var tempDir = Path.Combine(Path.GetTempPath(), $"video-{Guid.NewGuid():N}");
        Directory.CreateDirectory(tempDir);
        try
        {
            await RunYtDlpAsync([
                "-x", "--audio-format", "m4a",
                "--no-playlist", "--no-warnings",
                "-o", Path.Combine(tempDir, "%(id)s.%(ext)s"),
                videoUrl
            ], ct);

            var audioFile = Directory.GetFiles(tempDir).FirstOrDefault()
                ?? throw new InvalidOperationException($"yt-dlp produced no audio file for {videoUrl}");

            return (await File.ReadAllBytesAsync(audioFile, ct), "audio/mp4");
        }
        finally
        {
            try { Directory.Delete(tempDir, recursive: true); } catch { }
        }
    }

    // ── Bilibili API ──────────────────────────────────────────────────────────

    private sealed record BilibiliViewData(string Title, string Pic, IReadOnlyList<BilibiliPage> Pages);
    private sealed record BilibiliPage(int PageNumber, long Cid, string Part);
    private sealed record BilibiliSubtitleEntry(string Lan, string LanDoc, string SubtitleUrl);

    private static readonly int[] MixinKeyEncTab =
    [
        46, 47, 18, 2, 53, 8, 23, 32, 15, 50, 10, 31, 58, 3, 45, 35,
        27, 43, 5, 49, 33, 9, 42, 19, 29, 28, 14, 39, 12, 38, 41, 13,
        37, 48, 7, 16, 24, 55, 40, 61, 26, 17, 0, 1, 60, 51, 30, 4,
        22, 25, 54, 21, 56, 59, 6, 63, 57, 62, 11, 36, 20, 34, 44, 52
    ];

    private static (string? Bvid, int Page) ParseBilibiliUrl(string url)
    {
        try
        {
            var uri = new Uri(url);
            var match = Regex.Match(uri.AbsolutePath, @"/video/(BV[0-9A-Za-z]+)", RegexOptions.IgnoreCase);
            if (!match.Success) return (null, 1);

            var bvid = match.Groups[1].Value;
            var page = 1;
            foreach (var param in uri.Query.TrimStart('?').Split('&', StringSplitOptions.RemoveEmptyEntries))
            {
                var parts = param.Split('=', 2);
                if (parts.Length == 2 && parts[0] == "p" && int.TryParse(parts[1], out var p) && p > 0)
                {
                    page = p;
                    break;
                }
            }
            return (bvid, page);
        }
        catch
        {
            return (null, 1);
        }
    }

    private static string NormalizeBilibiliImageUrl(string url)
    {
        if (string.IsNullOrWhiteSpace(url)) return "";
        if (url.StartsWith("//", StringComparison.Ordinal)) return "https:" + url;
        if (url.StartsWith("http://", StringComparison.OrdinalIgnoreCase)) return "https://" + url[7..];
        return url;
    }

    private async Task<BilibiliViewData?> GetBilibiliViewAsync(string bvid, CancellationToken ct)
    {
        var cacheKey = $"bilibili_view:{bvid}";
        if (_cache.TryGetValue(cacheKey, out BilibiliViewData? cached))
            return cached;

        try
        {
            var request = new HttpRequestMessage(HttpMethod.Get,
                $"https://api.bilibili.com/x/web-interface/view?bvid={Uri.EscapeDataString(bvid)}");
            AddBilibiliHeaders(request);
            var response = await _httpClient.SendAsync(request, ct);
            var json = await response.Content.ReadAsStringAsync(ct);

            using var doc = JsonDocument.Parse(json);
            if (!doc.RootElement.TryGetProperty("data", out var data)) return null;

            var title = data.TryGetProperty("title", out var t) ? t.GetString() ?? "" : "";
            var pic = NormalizeBilibiliImageUrl(data.TryGetProperty("pic", out var p) ? p.GetString() ?? "" : "");

            var pages = new List<BilibiliPage>();
            if (data.TryGetProperty("pages", out var pagesArr))
            {
                foreach (var pageEl in pagesArr.EnumerateArray())
                {
                    var pageNum = pageEl.TryGetProperty("page", out var pn) ? pn.GetInt32() : 0;
                    var cid = pageEl.TryGetProperty("cid", out var c) ? c.GetInt64() : 0;
                    var part = pageEl.TryGetProperty("part", out var pt) ? pt.GetString() ?? "" : "";
                    pages.Add(new BilibiliPage(pageNum, cid, part));
                }
            }

            var viewData = new BilibiliViewData(title, pic, pages);
            _cache.Set(cacheKey, viewData, TimeSpan.FromMinutes(30));
            return viewData;
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to fetch Bilibili view data for {Bvid}", bvid);
            return null;
        }
    }

    private async Task<IReadOnlyList<BilibiliSubtitleEntry>?> GetBilibiliSubtitleListAsync(
        string bvid, long cid, CancellationToken ct)
    {
        try
        {
            var parameters = new Dictionary<string, string>
            {
                ["bvid"] = bvid,
                ["cid"] = cid.ToString()
            };

            var url = await BuildWbiSignedUrlAsync(
                "https://api.bilibili.com/x/player/wbi/v2", parameters, ct);

            var request = new HttpRequestMessage(HttpMethod.Get, url);
            AddBilibiliHeaders(request);
            var response = await _httpClient.SendAsync(request, ct);
            var json = await response.Content.ReadAsStringAsync(ct);

            using var doc = JsonDocument.Parse(json);
            if (!doc.RootElement.TryGetProperty("data", out var data)) return null;
            if (!data.TryGetProperty("subtitle", out var subtitle)) return null;
            if (!subtitle.TryGetProperty("subtitles", out var subtitles)) return null;

            var result = new List<BilibiliSubtitleEntry>();
            foreach (var s in subtitles.EnumerateArray())
            {
                var lan = s.TryGetProperty("lan", out var l) ? l.GetString() ?? "" : "";
                var lanDoc = s.TryGetProperty("lan_doc", out var ld) ? ld.GetString() ?? "" : "";
                var subUrl = s.TryGetProperty("subtitle_url", out var su) ? su.GetString() ?? "" : "";
                if (!string.IsNullOrEmpty(subUrl))
                    result.Add(new BilibiliSubtitleEntry(lan, lanDoc, subUrl));
            }
            return result;
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to fetch Bilibili subtitle list for {Bvid}/{Cid}", bvid, cid);
            return null;
        }
    }

    private async Task<IReadOnlyList<(TimeSpan Offset, TimeSpan Duration, string Text)>?> GetBilibiliCaptionsAsync(
        string videoUrl, CancellationToken ct)
    {
        var (bvid, page) = ParseBilibiliUrl(videoUrl);
        if (bvid == null) return null;

        var viewData = await GetBilibiliViewAsync(bvid, ct);
        if (viewData == null) return null;

        var pageData = viewData.Pages.FirstOrDefault(p => p.PageNumber == page)
            ?? viewData.Pages.FirstOrDefault();
        if (pageData == null) return null;

        var subtitleList = await GetBilibiliSubtitleListAsync(bvid, pageData.Cid, ct);
        if (subtitleList == null || subtitleList.Count == 0) return null;

        var preferred = subtitleList
            .OrderBy(s => GetBilibiliSubtitlePriority(s.Lan))
            .First();

        var subtitleUrl = preferred.SubtitleUrl.StartsWith("//")
            ? "https:" + preferred.SubtitleUrl
            : preferred.SubtitleUrl;

        try
        {
            var subtitleJson = await _httpClient.GetStringAsync(subtitleUrl, ct);
            return ParseBilibiliSubtitles(subtitleJson);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to download Bilibili subtitle from {Url}", subtitleUrl);
            return null;
        }
    }

    private static int GetBilibiliSubtitlePriority(string lan)
    {
        var lower = lan.ToLowerInvariant();
        if (lower is "zh-cn" or "zh_cn") return 0;
        if (lower.StartsWith("ai-zh")) return 1;
        if (lower.StartsWith("zh")) return 2;
        if (lower == "en") return 3;
        return 4;
    }

    private static IReadOnlyList<(TimeSpan Offset, TimeSpan Duration, string Text)> ParseBilibiliSubtitles(string json)
    {
        using var doc = JsonDocument.Parse(json);
        var result = new List<(TimeSpan, TimeSpan, string)>();

        if (!doc.RootElement.TryGetProperty("body", out var body)) return result;

        foreach (var item in body.EnumerateArray())
        {
            var from = item.TryGetProperty("from", out var f) ? f.GetDouble() : 0.0;
            var to = item.TryGetProperty("to", out var t) ? t.GetDouble() : 0.0;
            var content = item.TryGetProperty("content", out var c) ? c.GetString()?.Trim() ?? "" : "";

            if (string.IsNullOrEmpty(content)) continue;
            result.Add((TimeSpan.FromSeconds(from), TimeSpan.FromSeconds(Math.Max(0, to - from)), content));
        }

        return result;
    }

    private static void AddBilibiliHeaders(HttpRequestMessage request)
    {
        request.Headers.TryAddWithoutValidation("Referer", "https://www.bilibili.com");
        request.Headers.TryAddWithoutValidation("User-Agent",
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36");
    }

    // ── WBI signing ───────────────────────────────────────────────────────────

    private async Task<(string ImgKey, string SubKey)> GetWbiKeysAsync(CancellationToken ct)
    {
        const string cacheKey = "bilibili_wbi_keys";
        if (_cache.TryGetValue(cacheKey, out (string, string) cached))
            return cached;

        var request = new HttpRequestMessage(HttpMethod.Get, "https://api.bilibili.com/x/web-interface/nav");
        AddBilibiliHeaders(request);
        var response = await _httpClient.SendAsync(request, ct);
        var json = await response.Content.ReadAsStringAsync(ct);

        using var doc = JsonDocument.Parse(json);
        var wbiImg = doc.RootElement.GetProperty("data").GetProperty("wbi_img");
        var imgUrl = wbiImg.GetProperty("img_url").GetString() ?? "";
        var subUrl = wbiImg.GetProperty("sub_url").GetString() ?? "";

        var imgKey = Path.GetFileNameWithoutExtension(new Uri(imgUrl).AbsolutePath);
        var subKey = Path.GetFileNameWithoutExtension(new Uri(subUrl).AbsolutePath);

        var keys = (imgKey, subKey);
        _cache.Set(cacheKey, keys, TimeSpan.FromHours(12));
        return keys;
    }

    private static string GetMixinKey(string imgKey, string subKey)
    {
        var s = imgKey + subKey;
        return new string(MixinKeyEncTab.Take(32).Select(i => s[i]).ToArray());
    }

    private async Task<string> BuildWbiSignedUrlAsync(
        string baseUrl, Dictionary<string, string> parameters, CancellationToken ct)
    {
        var (imgKey, subKey) = await GetWbiKeysAsync(ct);
        var mixinKey = GetMixinKey(imgKey, subKey);

        parameters["wts"] = DateTimeOffset.UtcNow.ToUnixTimeSeconds().ToString();

        var query = string.Join("&",
            parameters
                .OrderBy(p => p.Key)
                .Select(p =>
                {
                    var val = new string(p.Value.Where(c => !"!'()*".Contains(c)).ToArray());
                    return $"{Uri.EscapeDataString(p.Key)}={Uri.EscapeDataString(val)}";
                }));

        var wRid = Convert.ToHexString(
            MD5.HashData(Encoding.UTF8.GetBytes(query + mixinKey))).ToLowerInvariant();

        return $"{baseUrl}?{query}&w_rid={wRid}";
    }

    private static bool IsBilibiliUrl(string url)
        => Uri.TryCreate(url, UriKind.Absolute, out var uri)
           && uri.Host.Contains("bilibili.com", StringComparison.OrdinalIgnoreCase);

    private static string ToSimplifiedChinese(string text)
    {
        if (string.IsNullOrEmpty(text)) return text;

        var sb = new StringBuilder(text.Length);
        foreach (var ch in text)
            sb.Append(TraditionalToSimplifiedMap.TryGetValue(ch, out var simplified) ? simplified : ch);
        return sb.ToString();
    }

    private static readonly IReadOnlyDictionary<char, char> TraditionalToSimplifiedMap = new Dictionary<char, char>
    {
        ['學'] = '学', ['習'] = '习', ['講'] = '讲', ['課'] = '课', ['視'] = '视', ['頻'] = '频',
        ['設'] = '设', ['計'] = '计', ['開'] = '开', ['發'] = '发', ['項'] = '项', ['實'] = '实',
        ['戰'] = '战', ['聽'] = '听', ['網'] = '网', ['站'] = '站', ['領'] = '领', ['驅'] = '驱',
        ['動'] = '动', ['務'] = '务', ['後'] = '后', ['端'] = '端', ['離'] = '离', ['層'] = '层',
        ['個'] = '个', ['們'] = '们', ['這'] = '这', ['那'] = '那', ['裡'] = '里', ['裏'] = '里',
        ['麼'] = '么', ['為'] = '为', ['與'] = '与', ['對'] = '对', ['從'] = '从', ['會'] = '会',
        ['來'] = '来', ['時'] = '时', ['還'] = '还', ['過'] = '过', ['現'] = '现', ['種'] = '种',
        ['樣'] = '样', ['點'] = '点', ['應'] = '应', ['當'] = '当', ['說'] = '说', ['讓'] = '让',
        ['問'] = '问', ['題'] = '题', ['義'] = '义', ['類'] = '类', ['總'] = '总', ['結'] = '结',
        ['構'] = '构', ['數'] = '数', ['據'] = '据', ['庫'] = '库', ['碼'] = '码', ['標'] = '标',
        ['準'] = '准', ['讀'] = '读', ['寫'] = '写', ['錄'] = '录', ['傳'] = '传', ['轉'] = '转',
        ['換'] = '换', ['態'] = '态', ['線'] = '线', ['進'] = '进', ['選'] = '选', ['擇'] = '择',
        ['創'] = '创', ['建'] = '建', ['刪'] = '删', ['除'] = '除', ['訂'] = '订', ['單'] = '单',
        ['頁'] = '页', ['檔'] = '档', ['案'] = '案', ['關'] = '关', ['閉'] = '闭', ['啟'] = '启',
        ['權'] = '权', ['限'] = '限', ['驗'] = '验', ['證'] = '证', ['認'] = '认',
        ['陸'] = '陆', ['戶'] = '户', ['組'] = '组', ['織'] = '织', ['產'] = '产',
        ['品'] = '品', ['質'] = '质', ['優'] = '优', ['化'] = '化', ['緩'] = '缓', ['存'] = '存',
        ['載'] = '载', ['獲'] = '获', ['取'] = '取', ['響'] = '响', ['異'] = '异', ['常'] = '常',
        ['錯'] = '错', ['誤'] = '误', ['處'] = '处', ['理'] = '理', ['調'] = '调', ['試'] = '试',
        ['併'] = '并', ['並'] = '并', ['貝'] = '贝', ['員'] = '员', ['運'] = '运', ['維'] = '维',
        ['廣'] = '广', ['場'] = '场', ['區'] = '区', ['國'] = '国', ['門'] = '门', ['間'] = '间',
        ['屬'] = '属', ['性'] = '性', ['繼'] = '继', ['續'] = '续', ['擴'] = '扩', ['展'] = '展',
        ['該'] = '该', ['語'] = '语', ['言'] = '言', ['編'] = '编', ['譯'] = '译', ['器'] = '器',
        ['資'] = '资', ['源'] = '源', ['壓'] = '压', ['縮'] = '缩', ['復'] = '复',
        ['雜'] = '杂', ['簡'] = '简', ['體'] = '体', ['繁'] = '繁', ['參'] = '参',
        ['導'] = '导', ['覽'] = '览', ['畫'] = '画', ['面'] = '面', ['顯'] = '显', ['示'] = '示',
        ['長'] = '长', ['短'] = '短', ['節'] = '节', ['鐘'] = '钟',
        ['測'] = '测', ['聯'] = '联', ['繫'] = '系',
        ['狀'] = '状', ['圖'] = '图', ['記'] = '记', ['範'] = '范',
        ['圍'] = '围', ['獨'] = '独', ['立'] = '立', ['級'] = '级', ['別'] = '别', ['萬'] = '万',
        ['億'] = '亿', ['餘'] = '余', ['確'] = '确',
    };

    // ── yt-dlp subprocess with proxy+cookie rotation ──────────────────────────

    private async Task<string> RunYtDlpAsync(IEnumerable<string> args, CancellationToken ct)
    {
        var argList = args.ToList();
        Exception? lastException = null;

        var credentials = _pool.GetNext();

        for (int attempt = 0; attempt < MaxYtDlpAttempts; attempt++)
        {
            var (proxy, cookieIndex, cookieBytes) = credentials;

            string? cookieFile = null;
            if (cookieBytes is { Length: > 0 })
            {
                cookieFile = Path.GetTempFileName();
                await File.WriteAllBytesAsync(cookieFile, cookieBytes, ct);
            }

            try
            {
                var (exitCode, stdout, stderr) = await RunProcessAsync(argList, proxy, cookieFile, ct);

                if (exitCode == 0)
                {
                    if (attempt > 0)
                        _logger.LogInformation("yt-dlp succeeded on attempt {Attempt} (proxy={Proxy}, cookie={Cookie})",
                            attempt + 1, proxy ?? "none", cookieIndex);
                    return stdout;
                }

                var failure = ClassifyFailure(stderr);
                _logger.LogWarning(
                    "yt-dlp attempt {Attempt}/{Max} failed ({Type}): {Error}",
                    attempt + 1, MaxYtDlpAttempts, failure, stderr.Trim().Split('\n')[^1]);

                lastException = new InvalidOperationException($"yt-dlp exited {exitCode}: {stderr.Trim()}");

                switch (failure)
                {
                    case YtDlpFailureType.ProxyError:
                        _pool.ReportProxyFailure(proxy);
                        credentials = _pool.GetNextExcludingProxy(proxy);
                        break;

                    case YtDlpFailureType.BotDetection:
                        _pool.ReportCookieFailure(cookieIndex);
                        credentials = _pool.GetNextExcludingCookie(proxy, cookieIndex);
                        break;

                    case YtDlpFailureType.NotRetryable:
                        // Video unavailable, private, no subtitles, etc. — stop immediately.
                        throw lastException;
                }
            }
            finally
            {
                if (cookieFile != null && File.Exists(cookieFile))
                    File.Delete(cookieFile);
            }
        }

        throw lastException ?? new InvalidOperationException("yt-dlp failed after all retry attempts");
    }

    private static async Task<(int ExitCode, string Stdout, string Stderr)> RunProcessAsync(
        IReadOnlyList<string> baseArgs, string? proxy, string? cookieFile, CancellationToken ct)
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

        foreach (var arg in baseArgs)
            process.StartInfo.ArgumentList.Add(arg);

        if (!string.IsNullOrWhiteSpace(proxy))
        {
            process.StartInfo.ArgumentList.Add("--proxy");
            process.StartInfo.ArgumentList.Add(proxy);
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

        return (process.ExitCode, await stdoutTask, await stderrTask);
    }

    // ── Failure classification ────────────────────────────────────────────────

    private enum YtDlpFailureType { ProxyError, BotDetection, NotRetryable, Unknown }

    private static YtDlpFailureType ClassifyFailure(string stderr)
    {
        var s = stderr.ToLowerInvariant();

        if (s.Contains("unable to connect to proxy")
            || s.Contains("proxy connection failed")
            || s.Contains("tunnel connection failed")
            || s.Contains("connection refused")
            || s.Contains("proxyconnect tcp")
            || s.Contains("proxy error"))
            return YtDlpFailureType.ProxyError;

        if (s.Contains("sign in to confirm")
            || s.Contains("are you a robot")
            || s.Contains("confirm you're not a robot")
            || s.Contains("please sign in")
            || s.Contains("http error 429")
            || s.Contains("too many requests")
            || s.Contains("http error 403"))
            return YtDlpFailureType.BotDetection;

        if (s.Contains("video unavailable")
            || s.Contains("private video")
            || s.Contains("this video is not available")
            || s.Contains("video has been removed")
            || s.Contains("no subtitles"))
            return YtDlpFailureType.NotRetryable;

        return YtDlpFailureType.Unknown;
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

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
        var chunks = System.Text.Json.JsonSerializer.Deserialize<List<WhisperTranscriptChunk>>(transcriptJson, new JsonSerializerOptions
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
            bool sentenceEnd = EndsWithSentencePunctuation(current);

            bool silenceGap = i < captions.Count - 1
                && (captions[i + 1].Offset - (offset + duration)).TotalSeconds > 2.0;

            bool lastCaption = i == captions.Count - 1;

            bool timeBreak = (offset - sentStart).TotalSeconds >= 30.0;

            if (sentenceEnd || silenceGap || lastCaption || timeBreak)
            {
                if (current.Length > 0)
                    sentences.Add((sentStart, NormalizeSentencePunctuation(current)));
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

    private static string NormalizeSentencePunctuation(string text)
    {
        text = Regex.Replace(text.Trim(), @"\s+([,.;:!?])", "$1");
        text = AddCommonCommas(text);
        if (text.Length == 0)
            return text;

        text = char.ToUpperInvariant(text[0]) + text[1..];
        if (EndsWithSentencePunctuation(text))
            return text;

        return text + ".";
    }

    private static bool EndsWithSentencePunctuation(string text)
        => text.EndsWith('.') || text.EndsWith('!') || text.EndsWith('?')
           || text.EndsWith('。') || text.EndsWith('！') || text.EndsWith('？');

    private static string AddCommonCommas(string text)
    {
        text = Regex.Replace(
            text,
            @"^(however|therefore|meanwhile|first|second|third|finally|for example|in addition|on the other hand)\s+",
            match => match.Groups[1].Value + ", ",
            RegexOptions.IgnoreCase);

        return Regex.Replace(
            text,
            @"\s+(however|although|though|whereas|while|but|which)\s+",
            match => ", " + match.Groups[1].Value + " ",
            RegexOptions.IgnoreCase);
    }
}
