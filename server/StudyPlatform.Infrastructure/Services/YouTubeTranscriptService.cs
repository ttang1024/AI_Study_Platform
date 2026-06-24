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

public partial class YouTubeTranscriptService : IYouTubeTranscriptService
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

            return TranscriptTextProcessor.Resegment(raw);
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

            return TranscriptTextProcessor.Resegment(raw);
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
                ? TranscriptTextProcessor.Resegment(raw)
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

}
