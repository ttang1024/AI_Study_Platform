using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
using System.Security.Cryptography;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using StudyPlatform.API.Extensions;
using StudyPlatform.Application.Common;
using StudyPlatform.Application.Documents.DTOs;
using StudyPlatform.Application.Notes.DTOs;
using StudyPlatform.Application.Services;
using StudyPlatform.Application.Settings;
using StudyPlatform.Application.WorkedProblems.Commands;
using StudyPlatform.Application.WorkedProblems.DTOs;
using StudyPlatform.Application.WorkedProblems.Queries;
using StudyPlatform.Application.YouTube.Commands;
using StudyPlatform.Application.YouTube.DTOs;
using StudyPlatform.Application.YouTube.Queries;
using StudyPlatform.Domain.Entities;
using StudyPlatform.Domain.Interfaces;
using StudyPlatform.Infrastructure.Data;

namespace StudyPlatform.API.Controllers;

public record TranscriptSegmentDto(double StartSeconds, string Text);
public record PlaylistVideoItemDto(string VideoId, string Title, string ThumbnailUrl);
public record YouTubeUrlRequest(string VideoUrl);
public record YouTubeChatRequest(string VideoUrl, string Message, IEnumerable<ChatHistoryEntry> History);
public record ChatHistoryEntry(string Role, string Content);

[ApiController]
[Route("api/videos")]
[Authorize]
[Produces("application/json")]
public class VideoController : ControllerBase
{
    private readonly IYouTubeTranscriptService _transcriptService;
    private readonly IAiService _aiService;
    private readonly IMediator _mediator;
    private readonly IUnitOfWork _unitOfWork;
    private readonly AppDbContext _db;
    private readonly IAppCache _cache;
    private readonly IBlobStorageService _blobStorageService;
    private readonly ITranscriptionService _transcriptionService;
    private readonly ITokenService _tokenService;
    private readonly CacheOptions _cacheOptions;
    private readonly AppLimitsOptions _limits;
    private const string TranscriptKind = "transcript";
    private const string SubtitlesKind = "subtitles";
    private const double MinTranscriptSegmentSeconds = 30.0;
    private const double MaxTranscriptSegmentSeconds = 60.0;

    public VideoController(IYouTubeTranscriptService transcriptService, IAiService aiService, IMediator mediator, IUnitOfWork unitOfWork, AppDbContext db, IAppCache cache, IBlobStorageService blobStorageService, ITranscriptionService transcriptionService, ITokenService tokenService, IOptions<CacheOptions> cacheOptions, IOptions<AppLimitsOptions> limits)
    {
        _transcriptService = transcriptService;
        _aiService = aiService;
        _mediator = mediator;
        _unitOfWork = unitOfWork;
        _db = db;
        _cache = cache;
        _blobStorageService = blobStorageService;
        _transcriptionService = transcriptionService;
        _tokenService = tokenService;
        _cacheOptions = cacheOptions.Value;
        _limits = limits.Value;
    }

    // ── Transcript ────────────────────────────────────────────────────────

    [HttpGet("transcript")]
    public async Task<IActionResult> GetTranscript([FromQuery] string videoId, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(videoId))
            return BadRequest(BaseResponse<string>.Fail("videoId is required.", "MISSING_VIDEO_ID"));

        var cacheKey = TranscriptSegmentsCacheKey(videoId);
        var ttl = TimeSpan.FromSeconds(_cacheOptions.TranscriptSeconds);

        var cached = await _cache.GetAsync<List<TranscriptSegmentDto>>(cacheKey, cancellationToken);
        if (cached != null)
            return Ok(BaseResponse<IReadOnlyList<TranscriptSegmentDto>>.Ok(PrepareTranscriptSegments(cached), "Transcript retrieved successfully."));

        var stored = await GetStoredTranscriptSegmentsAsync(videoId, TranscriptKind, cancellationToken)
                     ?? await GetStoredTranscriptSegmentsAsync(videoId, SubtitlesKind, cancellationToken);
        if (stored is { Count: > 0 })
        {
            var prepared = PrepareTranscriptSegments(stored);
            await _cache.SetAsync(cacheKey, prepared, ttl, cancellationToken);
            return Ok(BaseResponse<IReadOnlyList<TranscriptSegmentDto>>.Ok(prepared, "Transcript retrieved successfully."));
        }

        var segments = await _transcriptService.GetTranscriptAsync(videoId, cancellationToken);
        if (segments == null)
            return NotFound(BaseResponse<string>.Fail(
                "No captions found for this video.", "TRANSCRIPT_NOT_FOUND"));

        var dtos = segments.Select(s => new TranscriptSegmentDto(s.Start.TotalSeconds, s.Text)).ToList();
        dtos = PrepareTranscriptSegments(dtos);
        await StoreTranscriptSegmentsAsync(videoId, TranscriptKind, dtos, ttl, cancellationToken);
        await _cache.SetAsync(cacheKey, dtos, ttl, cancellationToken);
        return Ok(BaseResponse<IReadOnlyList<TranscriptSegmentDto>>.Ok(dtos, "Transcript retrieved successfully."));
    }

    [HttpGet("subtitles")]
    public async Task<IActionResult> GetSubtitles([FromQuery] string videoId, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(videoId))
            return BadRequest(BaseResponse<string>.Fail("videoId is required.", "MISSING_VIDEO_ID"));

        var cacheKey = SubtitlesCacheKey(videoId);
        var ttl = TimeSpan.FromSeconds(_cacheOptions.TranscriptSeconds);

        var cached = await _cache.GetAsync<List<TranscriptSegmentDto>>(cacheKey, cancellationToken);
        if (cached != null)
            return Ok(BaseResponse<IReadOnlyList<TranscriptSegmentDto>>.Ok(cached, "Subtitles retrieved successfully."));

        var stored = await GetStoredTranscriptSegmentsAsync(videoId, SubtitlesKind, cancellationToken);
        if (stored is { Count: > 0 })
        {
            await _cache.SetAsync(cacheKey, stored, ttl, cancellationToken);
            return Ok(BaseResponse<IReadOnlyList<TranscriptSegmentDto>>.Ok(stored, "Subtitles retrieved successfully."));
        }

        var segments = await _transcriptService.GetSubtitlesAsync(videoId, cancellationToken);
        if (segments == null)
            return NotFound(BaseResponse<string>.Fail(
                "No captions found for this video.", "SUBTITLES_NOT_FOUND"));

        var dtos = segments.Select(s => new TranscriptSegmentDto(s.Start.TotalSeconds, s.Text)).ToList();
        await StoreTranscriptSegmentsAsync(videoId, SubtitlesKind, dtos, ttl, cancellationToken);
        await _cache.SetAsync(cacheKey, dtos, ttl, cancellationToken);
        return Ok(BaseResponse<IReadOnlyList<TranscriptSegmentDto>>.Ok(dtos, "Subtitles retrieved successfully."));
    }

    [HttpGet("video-metadata")]
    public async Task<IActionResult> GetVideoMetadata([FromQuery] string videoUrl, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(videoUrl))
            return BadRequest(BaseResponse<object>.Fail("videoUrl is required.", "MISSING_VIDEO_URL"));

        var metadata = await _transcriptService.GetVideoMetadataAsync(videoUrl, cancellationToken);
        if (metadata == null)
            return NotFound(BaseResponse<object>.Fail("Could not fetch video metadata.", "METADATA_FETCH_ERROR"));

        return Ok(BaseResponse<object>.Ok(new { title = metadata.Title, thumbnailUrl = metadata.ThumbnailUrl }));
    }

    [HttpGet("playlist-items")]
    public async Task<IActionResult> GetPlaylistItems([FromQuery] string playlistId, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(playlistId))
            return BadRequest(BaseResponse<string>.Fail("playlistId is required.", "MISSING_PLAYLIST_ID"));

        try
        {
            var items = await _transcriptService.GetPlaylistItemsAsync(playlistId, cancellationToken);
            var dtos = items.Select(i => new PlaylistVideoItemDto(i.VideoId, i.Title, i.ThumbnailUrl)).ToList();
            return Ok(BaseResponse<IReadOnlyList<PlaylistVideoItemDto>>.Ok(dtos));
        }
        catch (Exception ex)
        {
            return BadRequest(BaseResponse<string>.Fail($"Failed to fetch playlist: {ex.Message}", "PLAYLIST_FETCH_ERROR"));
        }
    }

    [HttpGet("bilibili-items")]
    public async Task<IActionResult> GetBilibiliItems([FromQuery] string videoUrl, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(videoUrl))
            return BadRequest(BaseResponse<string>.Fail("videoUrl is required.", "MISSING_VIDEO_URL"));

        try
        {
            var items = await _transcriptService.GetBilibiliVideoItemsAsync(videoUrl, cancellationToken);
            var dtos = items.Select(i => new PlaylistVideoItemDto(i.VideoId, i.Title, i.ThumbnailUrl)).ToList();
            return Ok(BaseResponse<IReadOnlyList<PlaylistVideoItemDto>>.Ok(dtos));
        }
        catch (Exception ex)
        {
            return BadRequest(BaseResponse<string>.Fail($"Failed to fetch Bilibili videos: {ex.Message}", "BILIBILI_FETCH_ERROR"));
        }
    }

    // ── Access helper ─────────────────────────────────────────────────────

    private async Task<YouTubeVideo?> GetVideoWithAccessCheckAsync(Guid id, Guid userId, CancellationToken cancellationToken)
    {
        var video = await _unitOfWork.YouTubeVideos.GetByIdForUserAsync(id, userId, cancellationToken);
        if (video is not null) return video;

        video = await _unitOfWork.YouTubeVideos.GetByIdWithCourseAsync(id, cancellationToken);
        if (video is null) return null;

        var shared = await _unitOfWork.StudyGroupSharedCourses.FindAsync(sc => sc.CourseId == video.CourseId, cancellationToken);
        var groupIds = shared.Select(sc => sc.GroupId).ToList();
        var hasGroupAccess = groupIds.Count > 0 && await _unitOfWork.StudyGroupMembers.ExistsAsync(
            m => groupIds.Contains(m.GroupId) && m.UserId == userId, cancellationToken);
        return hasGroupAccess ? video : null;
    }

    // ── Transcript helper ─────────────────────────────────────────────────

    private static string? ExtractVideoId(string videoUrl)
    {
        try
        {
            var uri = new Uri(videoUrl);
            if (uri.Host.Contains("bilibili.com", StringComparison.OrdinalIgnoreCase))
            {
                var match = Regex.Match(uri.AbsolutePath, @"/video/(?<id>BV[0-9A-Za-z]+)", RegexOptions.IgnoreCase);
                if (match.Success)
                {
                    var page = 1;
                    foreach (var param in uri.Query.TrimStart('?').Split('&', StringSplitOptions.RemoveEmptyEntries))
                    {
                        var parts = param.Split('=', 2);
                        if (parts.Length == 2 && parts[0] == "p" && int.TryParse(parts[1], out var parsed) && parsed > 1)
                        {
                            page = parsed;
                            break;
                        }
                    }

                    var bvid = match.Groups["id"].Value;
                    return page > 1 ? $"{bvid}:p{page}" : bvid;
                }
            }
            if (uri.Host.Contains("youtu.be"))
                return uri.AbsolutePath.TrimStart('/').Split('?')[0];
            // Parse ?v= from query string without System.Web dependency
            foreach (var param in uri.Query.TrimStart('?').Split('&'))
            {
                var parts = param.Split('=', 2);
                if (parts.Length == 2 && parts[0] == "v" && !string.IsNullOrEmpty(parts[1]))
                    return Uri.UnescapeDataString(parts[1]);
            }
            var segments = uri.AbsolutePath.Split('/');
            for (var i = 0; i < segments.Length - 1; i++)
                if (segments[i] is "shorts" or "embed")
                    return segments[i + 1];
        }
        catch { }
        return null;
    }

    private static string NormalizeSourceType(string? sourceType) => sourceType?.Trim().ToLowerInvariant() switch
    {
        "bilibili" => "bilibili",
        "upload" => "upload",
        _ => "youtube"
    };

    private static bool IsExternalVideoSource(YouTubeVideo video)
        => string.Equals(video.SourceType, "bilibili", StringComparison.OrdinalIgnoreCase);

    private static bool IsBilibiliVideo(YouTubeVideo video)
        => string.Equals(video.SourceType, "bilibili", StringComparison.OrdinalIgnoreCase);

    private static string TranscriptCacheKey(string videoId) => $"transcript:{videoId}";
    private static string TranscriptSegmentsCacheKey(string videoId) => $"transcript_segments:{videoId}";
    private static string SubtitlesCacheKey(string videoId) => $"subtitles:{videoId}";
    private static string MindMapCacheKey(string videoId) => $"mindmap:{videoId}";
    private static string SummaryCacheKey(string videoId) => $"summary:{videoId}";
    private static string QuizCacheKey(string videoId) => $"quiz:{videoId}";
    private static string FlashcardsCacheKey(string videoId) => $"flashcards:{videoId}";
    private static string VideoFlashcardsCacheKey(Guid videoRecordId, Guid userId) => $"flashcards:video:{videoRecordId}:{userId}";
    private static string VideoGlossaryCacheKey(Guid videoRecordId, Guid userId) => $"glossary:video:{videoRecordId}:{userId}";
    private static string VideoQuizCacheKey(Guid videoRecordId, Guid userId, string difficulty) => $"quiz:video:{videoRecordId}:{userId}:{difficulty}";

    private async Task<List<TranscriptSegmentDto>?> GetStoredTranscriptSegmentsAsync(
        string videoId,
        string kind,
        CancellationToken cancellationToken)
    {
        var entryVideoId = TranscriptEntryVideoId(videoId);
        var entry = await _db.YouTubeTranscriptEntries.FindAsync([entryVideoId, kind], cancellationToken);
        if (entry is null)
            return null;

        if (entry.ExpiresAt <= DateTime.UtcNow)
        {
            _db.YouTubeTranscriptEntries.Remove(entry);
            await _db.SaveChangesAsync(cancellationToken);
            return null;
        }

        try
        {
            var segments = JsonSerializer.Deserialize<List<TranscriptSegmentDto>>(entry.SegmentsJson,
                new JsonSerializerOptions { PropertyNameCaseInsensitive = true });
            return kind == TranscriptKind && segments is not null
                ? PrepareTranscriptSegments(segments)
                : segments;
        }
        catch
        {
            _db.YouTubeTranscriptEntries.Remove(entry);
            await _db.SaveChangesAsync(cancellationToken);
            return null;
        }
    }

    private async Task StoreTranscriptSegmentsAsync(
        string videoId,
        string kind,
        IReadOnlyCollection<TranscriptSegmentDto> segments,
        TimeSpan ttl,
        CancellationToken cancellationToken)
    {
        if (segments.Count == 0)
            return;

        if (kind == TranscriptKind)
            segments = PrepareTranscriptSegments(segments);

        var now = DateTime.UtcNow;
        var expiresAt = now.Add(ttl);
        var segmentsJson = JsonSerializer.Serialize(segments);
        var entryVideoId = TranscriptEntryVideoId(videoId);

        await _db.Database.ExecuteSqlInterpolatedAsync($"""
            INSERT INTO "YouTubeTranscriptEntries" ("VideoId", "Kind", "SegmentsJson", "ExpiresAt", "CreatedAt", "UpdatedAt")
            VALUES ({entryVideoId}, {kind}, {segmentsJson}, {expiresAt}, {now}, {now})
            ON CONFLICT ("VideoId", "Kind") DO UPDATE
            SET "SegmentsJson" = EXCLUDED."SegmentsJson",
                "ExpiresAt" = EXCLUDED."ExpiresAt",
                "UpdatedAt" = EXCLUDED."UpdatedAt";
            """, cancellationToken);
    }

    private static string TranscriptEntryVideoId(string videoId)
    {
        if (videoId.Length <= 32)
            return videoId;

        var hash = SHA256.HashData(Encoding.UTF8.GetBytes(videoId));
        return Convert.ToHexString(hash).ToLowerInvariant()[..32];
    }

    // Returns transcript from Redis → DB → YouTube fetch (in that order), persisting to DB and Redis on miss.
    private async Task<string?> GetOrFetchTranscriptAsync(YouTubeVideo video, CancellationToken cancellationToken)
    {
        var transcriptKey = $"{NormalizeSourceType(video.SourceType)}:{video.VideoId}";
        var cacheKey = TranscriptCacheKey(transcriptKey);
        var ttl = TimeSpan.FromSeconds(_cacheOptions.TranscriptSeconds);

        var cached = await _cache.GetAsync<string>(cacheKey, cancellationToken);
        if (!string.IsNullOrEmpty(cached))
            return cached;

        if (!string.IsNullOrEmpty(video.Transcript))
        {
            await _cache.SetAsync(cacheKey, video.Transcript, ttl, cancellationToken);
            return video.Transcript;
        }

        var storedSegments = await GetStoredTranscriptSegmentsAsync(transcriptKey, SubtitlesKind, cancellationToken)
                             ?? await GetStoredTranscriptSegmentsAsync(transcriptKey, TranscriptKind, cancellationToken);
        if (storedSegments is { Count: > 0 })
        {
            var storedTranscript = string.Join(" ", storedSegments.Select(s => s.Text));
            video.Transcript = storedTranscript;
            video.UpdatedAt = DateTime.UtcNow;
            _unitOfWork.YouTubeVideos.Update(video);
            await _unitOfWork.SaveChangesAsync(cancellationToken);
            await _cache.SetAsync(cacheKey, storedTranscript, ttl, cancellationToken);
            return storedTranscript;
        }

        var segments = IsExternalVideoSource(video)
            ? await _transcriptService.GetSubtitlesFromUrlAsync(video.VideoUrl, cancellationToken)
            : await _transcriptService.GetSubtitlesAsync(video.VideoId, cancellationToken);
        var transcriptKind = SubtitlesKind;
        if (segments == null || segments.Count == 0)
        {
            segments = IsExternalVideoSource(video)
                ? await _transcriptService.GetTranscriptFromUrlAsync(video.VideoUrl, cancellationToken)
                : await _transcriptService.GetTranscriptAsync(video.VideoId, cancellationToken);
            transcriptKind = TranscriptKind;
        }
        if (segments == null || segments.Count == 0) return null;

        var dtos = segments.Select(s => new TranscriptSegmentDto(s.Start.TotalSeconds, s.Text)).ToList();
        var transcript = string.Join(" ", segments.Select(s => s.Text));
        video.Transcript = transcript;
        video.UpdatedAt = DateTime.UtcNow;
        _unitOfWork.YouTubeVideos.Update(video);
        await _unitOfWork.SaveChangesAsync(cancellationToken);
        await StoreTranscriptSegmentsAsync(transcriptKey, transcriptKind, dtos, ttl, cancellationToken);
        await _cache.SetAsync(cacheKey, transcript, ttl, cancellationToken);
        return transcript;
    }

    // Returns a timestamped transcript for a saved video (used by timeline-aware summary).
    private async Task<string?> GetOrFetchTimelineTranscriptAsync(YouTubeVideo video, CancellationToken cancellationToken)
    {
        var transcriptKey = $"{NormalizeSourceType(video.SourceType)}:{video.VideoId}";
        var segmentsCacheKey = TranscriptSegmentsCacheKey(transcriptKey);
        var ttl = TimeSpan.FromSeconds(_cacheOptions.TranscriptSeconds);

        var cached = await _cache.GetAsync<List<TranscriptSegmentDto>>(segmentsCacheKey, cancellationToken);
        if (cached is { Count: > 0 })
            return FormatTranscriptSegments(cached);

        var storedSegments = await GetStoredTranscriptSegmentsAsync(transcriptKey, SubtitlesKind, cancellationToken)
                             ?? await GetStoredTranscriptSegmentsAsync(transcriptKey, TranscriptKind, cancellationToken);
        if (storedSegments is { Count: > 0 })
        {
            await _cache.SetAsync(segmentsCacheKey, storedSegments, ttl, cancellationToken);
            return FormatTranscriptSegments(storedSegments);
        }

        var segments = IsExternalVideoSource(video)
            ? await _transcriptService.GetSubtitlesFromUrlAsync(video.VideoUrl, cancellationToken)
            : await _transcriptService.GetSubtitlesAsync(video.VideoId, cancellationToken);
        var transcriptKind = SubtitlesKind;
        if (segments == null || segments.Count == 0)
        {
            segments = IsExternalVideoSource(video)
                ? await _transcriptService.GetTranscriptFromUrlAsync(video.VideoUrl, cancellationToken)
                : await _transcriptService.GetTranscriptAsync(video.VideoId, cancellationToken);
            transcriptKind = TranscriptKind;
        }
        if (segments == null || segments.Count == 0)
            return await GetOrFetchTranscriptAsync(video, cancellationToken);

        var dtos = segments.Select(s => new TranscriptSegmentDto(s.Start.TotalSeconds, s.Text)).ToList();
        await StoreTranscriptSegmentsAsync(transcriptKey, transcriptKind, dtos, ttl, cancellationToken);
        await _cache.SetAsync(segmentsCacheKey, dtos, ttl, cancellationToken);
        return FormatTranscriptSegments(dtos);
    }

    // For anonymous endpoints: Redis → DB → YouTube fetch without requiring a saved video record.
    private async Task<string?> GetTranscriptTextAsync(string videoId, CancellationToken cancellationToken)
    {
        var cacheKey = TranscriptCacheKey(videoId);
        var ttl = TimeSpan.FromSeconds(_cacheOptions.TranscriptSeconds);

        var cached = await _cache.GetAsync<string>(cacheKey, cancellationToken);
        if (!string.IsNullOrEmpty(cached))
            return cached;

        var savedVideo = await _unitOfWork.YouTubeVideos.GetByVideoIdAsync(videoId, cancellationToken);
        if (savedVideo != null)
            return await GetOrFetchTranscriptAsync(savedVideo, cancellationToken);

        var storedSegments = await GetStoredTranscriptSegmentsAsync(videoId, SubtitlesKind, cancellationToken)
                             ?? await GetStoredTranscriptSegmentsAsync(videoId, TranscriptKind, cancellationToken);
        if (storedSegments is { Count: > 0 })
        {
            var storedTranscript = string.Join(" ", storedSegments.Select(s => s.Text));
            await _cache.SetAsync(cacheKey, storedTranscript, ttl, cancellationToken);
            return storedTranscript;
        }

        var segments = await _transcriptService.GetSubtitlesAsync(videoId, cancellationToken);
        var transcriptKind = SubtitlesKind;
        if (segments == null || segments.Count == 0)
        {
            segments = await _transcriptService.GetTranscriptAsync(videoId, cancellationToken);
            transcriptKind = TranscriptKind;
        }
        if (segments == null || segments.Count == 0) return null;

        var dtos = segments.Select(s => new TranscriptSegmentDto(s.Start.TotalSeconds, s.Text)).ToList();
        var transcript = string.Join(" ", dtos.Select(s => s.Text));
        await StoreTranscriptSegmentsAsync(videoId, transcriptKind, dtos, ttl, cancellationToken);
        await _cache.SetAsync(cacheKey, transcript, ttl, cancellationToken);
        return transcript;
    }

    private async Task<string?> GetTranscriptTimelineTextAsync(string videoId, CancellationToken cancellationToken)
    {
        var cacheKey = TranscriptSegmentsCacheKey(videoId);
        var ttl = TimeSpan.FromSeconds(_cacheOptions.TranscriptSeconds);

        var cached = await _cache.GetAsync<List<TranscriptSegmentDto>>(cacheKey, cancellationToken);
        if (cached is { Count: > 0 })
            return FormatTranscriptSegments(cached);

        var storedSegments = await GetStoredTranscriptSegmentsAsync(videoId, TranscriptKind, cancellationToken)
                             ?? await GetStoredTranscriptSegmentsAsync(videoId, SubtitlesKind, cancellationToken);
        if (storedSegments is { Count: > 0 })
        {
            await _cache.SetAsync(cacheKey, storedSegments, ttl, cancellationToken);
            return FormatTranscriptSegments(storedSegments);
        }

        var segments = await _transcriptService.GetSubtitlesAsync(videoId, cancellationToken);
        var transcriptKind = SubtitlesKind;
        if (segments == null || segments.Count == 0)
        {
            segments = await _transcriptService.GetTranscriptAsync(videoId, cancellationToken);
            transcriptKind = TranscriptKind;
        }
        if (segments is { Count: > 0 })
        {
            var dtos = segments.Select(s => new TranscriptSegmentDto(s.Start.TotalSeconds, s.Text)).ToList();
            await StoreTranscriptSegmentsAsync(videoId, transcriptKind, dtos, ttl, cancellationToken);
            await _cache.SetAsync(cacheKey, dtos, ttl, cancellationToken);
            return FormatTranscriptSegments(dtos);
        }

        return await GetTranscriptTextAsync(videoId, cancellationToken);
    }

    private static List<TranscriptSegmentDto> PrepareTranscriptSegments(IEnumerable<TranscriptSegmentDto> segments)
        => SegmentTranscriptForReading(segments)
            .Select(s => new TranscriptSegmentDto(s.StartSeconds, NormalizeTranscriptSentence(s.Text)))
            .ToList();

    private static List<TranscriptSegmentDto> SegmentTranscriptForReading(IEnumerable<TranscriptSegmentDto> segments)
    {
        var ordered = segments
            .Where(s => !string.IsNullOrWhiteSpace(s.Text))
            .OrderBy(s => s.StartSeconds)
            .ToList();

        if (ordered.Count <= 1)
            return ordered;

        var result = new List<TranscriptSegmentDto>();
        var segmentStart = ordered[0].StartSeconds;
        var segmentText = new StringBuilder();

        for (var i = 0; i < ordered.Count; i++)
        {
            var current = ordered[i];
            var currentStart = current.StartSeconds;
            var nextStart = i + 1 < ordered.Count ? ordered[i + 1].StartSeconds : (double?)null;
            var elapsedToCurrent = currentStart - segmentStart;

            if (segmentText.Length > 0 && elapsedToCurrent >= MinTranscriptSegmentSeconds)
            {
                result.Add(new TranscriptSegmentDto(segmentStart, segmentText.ToString()));
                segmentText.Clear();
                segmentStart = currentStart;
            }

            if (segmentText.Length == 0)
                segmentStart = currentStart;
            else
                segmentText.Append(' ');

            segmentText.Append(current.Text.Trim());

            if (nextStart.HasValue && nextStart.Value - segmentStart >= MaxTranscriptSegmentSeconds)
            {
                result.Add(new TranscriptSegmentDto(segmentStart, segmentText.ToString()));
                segmentText.Clear();
            }
        }

        if (segmentText.Length > 0)
            result.Add(new TranscriptSegmentDto(segmentStart, segmentText.ToString()));

        MergeShortTrailingSegment(result);
        return result;
    }

    private static void MergeShortTrailingSegment(List<TranscriptSegmentDto> segments)
    {
        if (segments.Count < 2)
            return;

        var last = segments[^1];
        var previous = segments[^2];
        var trailingDuration = last.StartSeconds - previous.StartSeconds;

        if (trailingDuration >= MinTranscriptSegmentSeconds)
            return;

        segments[^2] = previous with { Text = $"{previous.Text.Trim()} {last.Text.Trim()}" };
        segments.RemoveAt(segments.Count - 1);
    }

    private static string NormalizeTranscriptSentence(string text)
    {
        text = Regex.Replace(text.Trim(), @"\s+([,.;:!?])", "$1");
        text = AddCommonCommas(text);
        if (text.Length == 0)
            return text;

        text = char.ToUpperInvariant(text[0]) + text[1..];
        return EndsWithSentencePunctuation(text) ? text : text + ".";
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

    private static string FormatTranscriptSegments(IEnumerable<TranscriptSegmentDto> segments)
    {
        var list = segments
            .Where(s => !string.IsNullOrWhiteSpace(s.Text))
            .ToList();

        var lines = new List<string>();
        for (var i = 0; i < list.Count; i++)
        {
            var start = list[i].StartSeconds;
            var end = i + 1 < list.Count ? list[i + 1].StartSeconds : start;
            var timestamp = end > start
                ? $"{FormatTimestamp(start)} – {FormatTimestamp(end)}"
                : FormatTimestamp(start);
            lines.Add($"{timestamp} {list[i].Text.Trim()}");
        }

        return string.Join('\n', lines);
    }

    private static string FormatTimestamp(double seconds)
    {
        var time = TimeSpan.FromSeconds(Math.Max(0, seconds));
        return time.TotalHours >= 1
            ? $"{(int)time.TotalHours}:{time.Minutes:D2}:{time.Seconds:D2}"
            : $"{time.Minutes:D2}:{time.Seconds:D2}";
    }

    private static List<TranscriptSegmentDto> ParseWhisperTranscriptDtos(string transcriptJson)
    {
        try
        {
            var chunks = JsonSerializer.Deserialize<List<WhisperTranscriptChunk>>(transcriptJson, new JsonSerializerOptions
            {
                PropertyNameCaseInsensitive = true
            }) ?? [];

            return chunks
                .Where(c => !string.IsNullOrWhiteSpace(c.Text))
                .Select(c => new TranscriptSegmentDto(c.Start, c.Text.Trim()))
                .ToList();
        }
        catch
        {
            return [];
        }
    }

    private sealed record WhisperTranscriptChunk(double Start, double End, string Text);

    // ── AI generation ─────────────────────────────────────────────────────

    [HttpPost("mindmap")]
    public async Task<IActionResult> GenerateMindMap([FromBody] YouTubeUrlRequest request, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.VideoUrl))
            return BadRequest(BaseResponse<string>.Fail("videoUrl is required.", "MISSING_VIDEO_URL"));

        var videoId = ExtractVideoId(request.VideoUrl);
        if (videoId == null) return BadRequest(BaseResponse<string>.Fail("Invalid YouTube URL.", "INVALID_VIDEO_URL"));

        var ttl = TimeSpan.FromSeconds(_cacheOptions.GeneratedResultSeconds);
        var cacheKey = MindMapCacheKey(videoId);
        var cached = await _cache.GetAsync<string>(cacheKey, cancellationToken);
        if (!string.IsNullOrEmpty(cached))
            return Ok(BaseResponse<string>.Ok(cached));

        var transcript = await GetTranscriptTextAsync(videoId, cancellationToken);
        if (transcript == null) return BadRequest(BaseResponse<string>.Fail("No subtitles available for this video.", "NO_TRANSCRIPT"));

        var result = await _aiService.GenerateMindMapFromYouTubeAsync(transcript, cancellationToken);
        await _cache.SetAsync(cacheKey, result, ttl, cancellationToken);
        return Ok(BaseResponse<string>.Ok(result));
    }

    [HttpPost("mindmap/stream")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(BaseResponse<string>), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(BaseResponse<string>), StatusCodes.Status429TooManyRequests)]
    [ProducesResponseType(typeof(BaseResponse<string>), StatusCodes.Status502BadGateway)]
    public async Task<IActionResult> StreamMindMap([FromBody] YouTubeUrlRequest request, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.VideoUrl))
            return BadRequest(BaseResponse<string>.Fail("videoUrl is required.", "MISSING_VIDEO_URL"));

        var videoId = ExtractVideoId(request.VideoUrl);
        if (videoId == null)
            return BadRequest(BaseResponse<string>.Fail("Invalid YouTube URL.", "INVALID_VIDEO_URL"));

        var ttl = TimeSpan.FromSeconds(_cacheOptions.GeneratedResultSeconds);
        var cacheKey = MindMapCacheKey(videoId);
        var cached = await _cache.GetAsync<string>(cacheKey, cancellationToken);
        if (!string.IsNullOrEmpty(cached))
        {
            Response.SetSseHeaders();
            await Response.WriteSseDataAsync(cached, cancellationToken);
            await Response.WriteSseDoneAsync(cancellationToken);
            return new EmptyResult();
        }

        var transcript = await GetTranscriptTextAsync(videoId, cancellationToken);
        if (transcript == null)
            return BadRequest(BaseResponse<string>.Fail("No subtitles available for this video.", "NO_TRANSCRIPT"));

        var stream = _aiService.StreamMindMapFromYouTubeAsync(transcript, cancellationToken);
        await using var enumerator = stream.GetAsyncEnumerator(cancellationToken);

        string? firstChunk;
        try
        {
            if (!await enumerator.MoveNextAsync())
                return NoContent();

            firstChunk = enumerator.Current;
        }
        catch (OperationCanceledException)
        {
            return new EmptyResult();
        }
        catch (Exception ex)
        {
            return AiStreamError(ex);
        }

        Response.SetSseHeaders();

        var fullText = new StringBuilder();
        try
        {
            fullText.Append(firstChunk);
            await Response.WriteSseDataAsync(firstChunk, cancellationToken);

            while (await enumerator.MoveNextAsync())
            {
                var chunk = enumerator.Current;
                fullText.Append(chunk);
                await Response.WriteSseDataAsync(chunk, cancellationToken);
            }

            if (fullText.Length > 0)
                await _cache.SetAsync(cacheKey, fullText.ToString(), ttl, cancellationToken);
        }
        catch (OperationCanceledException) { return new EmptyResult(); }
        catch (Exception ex)
        {
            await Response.WriteSseDataAsync("[ERROR] " + ex.Message, cancellationToken);
        }

        await Response.WriteSseDoneAsync(cancellationToken);
        return new EmptyResult();
    }

    [HttpPost("{id:guid}/mindmap/stream")]
    public async Task<IActionResult> StreamVideoMindMap(Guid id, CancellationToken cancellationToken)
    {
        var userId = User.GetUserId();
        var video = await GetVideoWithAccessCheckAsync(id, userId, cancellationToken);
        if (video is null)
            return NotFound(BaseResponse<string>.Fail("Video not found.", "VIDEO_NOT_FOUND"));

        var transcript = await GetOrFetchTranscriptAsync(video, cancellationToken);
        if (transcript == null)
            return BadRequest(BaseResponse<string>.Fail("No subtitles available for this video.", "NO_TRANSCRIPT"));

        var stream = _aiService.StreamMindMapFromYouTubeAsync(transcript, cancellationToken);
        await using var enumerator = stream.GetAsyncEnumerator(cancellationToken);

        string? firstChunk;
        try
        {
            if (!await enumerator.MoveNextAsync())
                return NoContent();
            firstChunk = enumerator.Current;
        }
        catch (OperationCanceledException) { return new EmptyResult(); }
        catch (Exception ex) { return AiStreamError(ex); }

        Response.SetSseHeaders();
        var fullText = new StringBuilder();
        try
        {
            fullText.Append(firstChunk);
            await Response.WriteSseDataAsync(firstChunk, cancellationToken);
            while (await enumerator.MoveNextAsync())
            {
                var chunk = enumerator.Current;
                fullText.Append(chunk);
                await Response.WriteSseDataAsync(chunk, cancellationToken);
            }

            if (fullText.Length > 0)
            {
                video.MindMapText = fullText.ToString();
                video.UpdatedAt = DateTime.UtcNow;
                _unitOfWork.YouTubeVideos.Update(video);
                await _unitOfWork.SaveChangesAsync(cancellationToken);
            }
        }
        catch (OperationCanceledException) { return new EmptyResult(); }
        catch (Exception ex) { await Response.WriteSseDataAsync("[ERROR] " + ex.Message, cancellationToken); }

        await Response.WriteSseDoneAsync(cancellationToken);
        return new EmptyResult();
    }

    private ObjectResult AiStreamError(Exception ex)
    {
        return AiErrorMapper.ToObjectResult(this, ex.Message);
    }

    [HttpPost("quiz")]
    public async Task<IActionResult> GenerateQuiz([FromBody] YouTubeUrlRequest request, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.VideoUrl))
            return BadRequest(BaseResponse<string>.Fail("videoUrl is required.", "MISSING_VIDEO_URL"));

        var videoId = ExtractVideoId(request.VideoUrl);
        if (videoId == null) return BadRequest(BaseResponse<string>.Fail("Invalid YouTube URL.", "INVALID_VIDEO_URL"));

        var ttl = TimeSpan.FromSeconds(_cacheOptions.GeneratedResultSeconds);
        var cacheKey = QuizCacheKey(videoId);
        var cached = await _cache.GetAsync<string>(cacheKey, cancellationToken);
        if (!string.IsNullOrEmpty(cached))
            return Ok(BaseResponse<string>.Ok(cached));

        var transcript = await GetTranscriptTextAsync(videoId, cancellationToken);
        if (transcript == null) return BadRequest(BaseResponse<string>.Fail("No subtitles available for this video.", "NO_TRANSCRIPT"));

        var result = await _aiService.GenerateQuizFromYouTubeAsync(transcript, "medium", cancellationToken);
        await _cache.SetAsync(cacheKey, result, ttl, cancellationToken);
        return Ok(BaseResponse<string>.Ok(result));
    }

    [HttpPost("flashcards")]
    public async Task<IActionResult> GenerateFlashcards([FromBody] YouTubeUrlRequest request, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.VideoUrl))
            return BadRequest(BaseResponse<string>.Fail("videoUrl is required.", "MISSING_VIDEO_URL"));

        var videoId = ExtractVideoId(request.VideoUrl);
        if (videoId == null) return BadRequest(BaseResponse<string>.Fail("Invalid YouTube URL.", "INVALID_VIDEO_URL"));

        var ttl = TimeSpan.FromSeconds(_cacheOptions.GeneratedResultSeconds);
        var cacheKey = FlashcardsCacheKey(videoId);
        var cached = await _cache.GetAsync<string>(cacheKey, cancellationToken);
        if (!string.IsNullOrEmpty(cached))
            return Ok(BaseResponse<string>.Ok(cached));

        var transcript = await GetTranscriptTextAsync(videoId, cancellationToken);
        if (transcript == null) return BadRequest(BaseResponse<string>.Fail("No subtitles available for this video.", "NO_TRANSCRIPT"));

        var result = await _aiService.GenerateFlashcardsFromYouTubeAsync(transcript, cancellationToken);
        await _cache.SetAsync(cacheKey, result, ttl, cancellationToken);
        return Ok(BaseResponse<string>.Ok(result));
    }

    [HttpPost("chat")]
    public async Task<IActionResult> Chat([FromBody] YouTubeChatRequest request, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.VideoUrl))
            return BadRequest(BaseResponse<string>.Fail("videoUrl is required.", "MISSING_VIDEO_URL"));
        if (string.IsNullOrWhiteSpace(request.Message))
            return BadRequest(BaseResponse<string>.Fail("message is required.", "MISSING_MESSAGE"));

        var videoId = ExtractVideoId(request.VideoUrl);
        if (videoId == null) return BadRequest(BaseResponse<string>.Fail("Invalid YouTube URL.", "INVALID_VIDEO_URL"));
        var transcript = await GetTranscriptTextAsync(videoId, cancellationToken);
        if (transcript == null) return BadRequest(BaseResponse<string>.Fail("No subtitles available for this video.", "NO_TRANSCRIPT"));

        var history = (request.History ?? []).Select(h => (h.Role, h.Content));
        var reply = await _aiService.ChatWithYouTubeAsync(transcript, history, request.Message, cancellationToken);
        return Ok(BaseResponse<string>.Ok(reply));
    }

    // ── Saved video chat (persisted) ─────────────────────────────────────

    [HttpPost("{id:guid}/chat")]
    [ProducesResponseType(typeof(BaseResponse<ChatMessageDto>), 200)]
    public async Task<IActionResult> VideoChat(Guid id, [FromBody] AIChatRequest request, CancellationToken cancellationToken)
    {
        var userId = User.GetUserId();
        var result = await _mediator.Send(new AIVideoChatCommand(id, userId, request.Message), cancellationToken);
        if (!result.IsSuccess)
            return NotFound(BaseResponse<ChatMessageDto>.Fail(result.Message, result.ErrorCode));
        return Ok(BaseResponse<ChatMessageDto>.Ok(result.Data!, result.Message));
    }

    [HttpGet("{id:guid}/chat")]
    [ProducesResponseType(typeof(BaseResponse<IEnumerable<ChatMessageDto>>), 200)]
    public async Task<IActionResult> GetVideoChatHistory(Guid id, CancellationToken cancellationToken)
    {
        var userId = User.GetUserId();
        var video = await GetVideoWithAccessCheckAsync(id, userId, cancellationToken);
        if (video is null)
            return NotFound(BaseResponse<IEnumerable<ChatMessageDto>>.Fail("Video not found.", "VIDEO_NOT_FOUND"));

        var messages = await _unitOfWork.ChatMessages.GetByYouTubeVideoIdAsync(id, video.UserId, cancellationToken);
        var dtos = messages.Select(m => new ChatMessageDto(m.MessageId, m.DocumentId, m.YouTubeVideoId, m.SourceType, m.Role, m.Content, m.CreatedAt));
        return Ok(BaseResponse<IEnumerable<ChatMessageDto>>.Ok(dtos));
    }

    [HttpDelete("{id:guid}/chat")]
    [ProducesResponseType(typeof(BaseResponse<string>), 200)]
    [ProducesResponseType(typeof(BaseResponse), 404)]
    public async Task<IActionResult> DeleteVideoChatHistory(Guid id, CancellationToken cancellationToken)
    {
        var userId = User.GetUserId();
        var video = await GetVideoWithAccessCheckAsync(id, userId, cancellationToken);
        if (video is null)
            return NotFound(BaseResponse<string>.Fail("Video not found.", "VIDEO_NOT_FOUND"));

        await _unitOfWork.ChatMessages.DeleteByYouTubeVideoIdAsync(id, userId, cancellationToken);
        await _unitOfWork.SaveChangesAsync(cancellationToken);
        return Ok(BaseResponse<string>.Ok("Chat history deleted."));
    }

    // ── Video library (CRUD) ──────────────────────────────────────────────

    [HttpPost]
    public async Task<IActionResult> SaveVideo([FromBody] SaveYouTubeVideoRequest request, CancellationToken cancellationToken)
    {
        var userId = User.GetUserId();
        var result = await _mediator.Send(new SaveYouTubeVideoCommand(
            userId, request.CourseId, request.VideoId,
            request.VideoUrl, request.SourceType, request.Title, request.ThumbnailUrl, request.Summary), cancellationToken);

        if (!result.IsSuccess)
            return BadRequest(BaseResponse<YouTubeVideoDto>.Fail(result.Message, result.ErrorCode));

        return Ok(BaseResponse<YouTubeVideoDto>.Ok(result.Data!));
    }

    [HttpPost("upload")]
    [RequestSizeLimit(524288000)] // 500 MB
    public async Task<IActionResult> UploadVideo(
        [FromForm] Guid courseId,
        [FromForm] IFormFile file,
        [FromForm] IFormFile? thumbnail,
        CancellationToken cancellationToken)
    {
        if (file == null || file.Length == 0)
            return BadRequest(BaseResponse<YouTubeVideoDto>.Fail("No file provided.", "NO_FILE"));

        var ext = Path.GetExtension(file.FileName).ToLowerInvariant();
        var allowedExtensions = new[] { ".mp4", ".mov", ".m4v", ".webm", ".mkv", ".avi" };
        if (!file.ContentType.StartsWith("video/", StringComparison.OrdinalIgnoreCase) && !allowedExtensions.Contains(ext))
            return BadRequest(BaseResponse<YouTubeVideoDto>.Fail("File type not supported. Allowed: MP4, MOV, WEBM, MKV, AVI.", "INVALID_FILE_TYPE"));

        var userId = User.GetUserId();
        var course = await _unitOfWork.Courses.GetByIdAsync(courseId, cancellationToken);
        if (course == null || course.UserId != userId)
            return BadRequest(BaseResponse<YouTubeVideoDto>.Fail("Course not found.", "COURSE_NOT_FOUND"));

        if (_limits.VideoUploadLimit >= 0)
        {
            var count = await _unitOfWork.YouTubeVideos.CountAsync(
                v => v.UserId == userId && v.SourceType == "upload",
                cancellationToken);
            if (count >= _limits.VideoUploadLimit)
                return BadRequest(BaseResponse<YouTubeVideoDto>.Fail(
                    $"Upload limit of {_limits.VideoUploadLimit} videos per account reached.",
                    "VIDEO_LIMIT_REACHED"));
        }

        await using var ms = new MemoryStream();
        await file.CopyToAsync(ms, cancellationToken);
        var bytes = ms.ToArray();
        await using var uploadStream = new MemoryStream(bytes);
        var blobName = $"{userId}/{courseId}/videos/{Guid.NewGuid()}_{file.FileName}";
        var blobUrl = await _blobStorageService.UploadAsync(uploadStream, blobName, file.ContentType, cancellationToken);
        var thumbnailUrl = string.Empty;
        if (thumbnail is { Length: > 0 } && thumbnail.ContentType.StartsWith("image/", StringComparison.OrdinalIgnoreCase))
        {
            var thumbnailExt = Path.GetExtension(thumbnail.FileName);
            if (string.IsNullOrWhiteSpace(thumbnailExt))
                thumbnailExt = ".jpg";

            await using var thumbnailStream = thumbnail.OpenReadStream();
            var thumbnailBlobName = $"{userId}/{courseId}/videos/covers/{Guid.NewGuid()}{thumbnailExt}";
            thumbnailUrl = await _blobStorageService.UploadAsync(thumbnailStream, thumbnailBlobName, thumbnail.ContentType, cancellationToken);
        }

        var transcriptJson = await _transcriptionService.TranscribeAsync(bytes, file.ContentType, cancellationToken);
        var segments = ParseWhisperTranscriptDtos(transcriptJson);
        var transcript = string.Join(" ", segments.Select(s => s.Text));
        var videoId = $"upload-{Guid.NewGuid():N}";

        var video = new YouTubeVideo
        {
            YouTubeVideoId = Guid.NewGuid(),
            UserId = userId,
            CourseId = courseId,
            VideoId = videoId,
            VideoUrl = blobUrl,
            SourceType = "upload",
            Title = Path.GetFileNameWithoutExtension(file.FileName),
            ThumbnailUrl = thumbnailUrl,
            Transcript = transcript,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
        };

        await _unitOfWork.YouTubeVideos.AddAsync(video, cancellationToken);
        await _unitOfWork.SaveChangesAsync(cancellationToken);
        await StoreTranscriptSegmentsAsync($"upload:{videoId}", TranscriptKind, segments, TimeSpan.FromSeconds(_cacheOptions.TranscriptSeconds), cancellationToken);

        var saved = await _unitOfWork.YouTubeVideos.GetByIdForUserAsync(video.YouTubeVideoId, userId, cancellationToken);
        return StatusCode(StatusCodes.Status201Created, BaseResponse<YouTubeVideoDto>.Ok(SaveYouTubeVideoCommandHandler.ToDto(saved!)));
    }

    [HttpGet("{id:guid}/playback-url")]
    public async Task<IActionResult> GetPlaybackUrl(Guid id, CancellationToken cancellationToken)
    {
        var userId = User.GetUserId();
        var video = await GetVideoWithAccessCheckAsync(id, userId, cancellationToken);
        if (video is null)
            return NotFound(BaseResponse<string>.Fail("Video not found.", "VIDEO_NOT_FOUND"));

        if (!string.Equals(video.SourceType, "upload", StringComparison.OrdinalIgnoreCase))
            return Ok(BaseResponse<string>.Ok(video.VideoUrl));

        var url = await _blobStorageService.GetSasUrlAsync(video.VideoUrl, expiryMinutes: 60);
        return Ok(BaseResponse<string>.Ok(url));
    }

    [AllowAnonymous]
    [HttpGet("{id:guid}/file")]
    public async Task<IActionResult> GetUploadedVideoFile(Guid id, [FromQuery(Name = "access_token")] string? accessToken, CancellationToken cancellationToken)
    {
        var userId = User.Identity?.IsAuthenticated == true
            ? User.GetUserId()
            : !string.IsNullOrWhiteSpace(accessToken)
                ? _tokenService.ValidateAccessToken(accessToken)
                : null;

        if (userId is null)
            return Unauthorized();

        var video = await GetVideoWithAccessCheckAsync(id, userId.Value, cancellationToken);
        if (video is null || !string.Equals(video.SourceType, "upload", StringComparison.OrdinalIgnoreCase))
            return NotFound();

        var stream = await _blobStorageService.DownloadAsync(video.VideoUrl, cancellationToken);
        return File(stream, GetVideoContentType(video.VideoUrl), enableRangeProcessing: true);
    }

    [AllowAnonymous]
    [HttpGet("{id:guid}/thumbnail")]
    public async Task<IActionResult> GetUploadedVideoThumbnail(Guid id, [FromQuery(Name = "access_token")] string? accessToken, CancellationToken cancellationToken)
    {
        var userId = User.Identity?.IsAuthenticated == true
            ? User.GetUserId()
            : !string.IsNullOrWhiteSpace(accessToken)
                ? _tokenService.ValidateAccessToken(accessToken)
                : null;

        if (userId is null)
            return Unauthorized();

        var video = await GetVideoWithAccessCheckAsync(id, userId.Value, cancellationToken);
        if (video is null || string.IsNullOrEmpty(video.ThumbnailUrl))
            return NotFound();

        var stream = await _blobStorageService.DownloadAsync(video.ThumbnailUrl, cancellationToken);
        var ext = Path.GetExtension(video.ThumbnailUrl).ToLowerInvariant();
        var contentType = ext == ".png" ? "image/png" : ext == ".webp" ? "image/webp" : "image/jpeg";
        return File(stream, contentType);
    }

    private static string GetVideoContentType(string blobUrl)
    {
        var path = blobUrl;
        if (Uri.TryCreate(blobUrl, UriKind.Absolute, out var uri))
            path = uri.AbsolutePath;

        return Path.GetExtension(Uri.UnescapeDataString(path)).ToLowerInvariant() switch
        {
            ".mp4" or ".m4v" => "video/mp4",
            ".mov" => "video/quicktime",
            ".webm" => "video/webm",
            ".mkv" => "video/x-matroska",
            ".avi" => "video/x-msvideo",
            _ => "application/octet-stream"
        };
    }

    [HttpGet]
    public async Task<IActionResult> GetVideos(
        [FromQuery] Guid? courseId,
        [FromQuery] string? search,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 12,
        CancellationToken cancellationToken = default)
    {
        var userId = User.GetUserId();
        var result = await _mediator.Send(new GetYouTubeVideosQuery(userId, courseId, search, page, pageSize), cancellationToken);
        return Ok(BaseResponse<YouTubeVideoPagedResult>.Ok(result.Data!));
    }

    [HttpGet("{id:guid}")]
    public async Task<IActionResult> GetVideo(Guid id, CancellationToken cancellationToken)
    {
        var userId = User.GetUserId();
        var result = await _mediator.Send(new GetYouTubeVideoByIdQuery(id, userId), cancellationToken);

        if (!result.IsSuccess)
            return NotFound(BaseResponse<YouTubeVideoDto>.Fail(result.Message, result.ErrorCode));

        return Ok(BaseResponse<YouTubeVideoDto>.Ok(result.Data!));
    }

    [HttpGet("{id:guid}/transcript")]
    public async Task<IActionResult> GetVideoTranscript(Guid id, CancellationToken cancellationToken)
    {
        var userId = User.GetUserId();
        var video = await GetVideoWithAccessCheckAsync(id, userId, cancellationToken);
        if (video is null)
            return NotFound(BaseResponse<IReadOnlyList<TranscriptSegmentDto>>.Fail("Video not found.", "VIDEO_NOT_FOUND"));

        var transcriptKey = $"{NormalizeSourceType(video.SourceType)}:{video.VideoId}";
        var ttl = TimeSpan.FromSeconds(_cacheOptions.TranscriptSeconds);
        var stored = await GetStoredTranscriptSegmentsAsync(transcriptKey, TranscriptKind, cancellationToken)
                     ?? await GetStoredTranscriptSegmentsAsync(transcriptKey, SubtitlesKind, cancellationToken);
        if (stored is { Count: > 0 })
            return Ok(BaseResponse<IReadOnlyList<TranscriptSegmentDto>>.Ok(PrepareTranscriptSegments(stored)));

        var text = await GetOrFetchTranscriptAsync(video, cancellationToken);
        if (string.IsNullOrWhiteSpace(text))
            return NotFound(BaseResponse<IReadOnlyList<TranscriptSegmentDto>>.Fail("No captions found for this video.", "TRANSCRIPT_NOT_FOUND"));

        // GetOrFetchTranscriptAsync stores properly segmented data — re-read it instead of
        // collapsing everything into a single segment at t=0.
        var freshStored = await GetStoredTranscriptSegmentsAsync(transcriptKey, TranscriptKind, cancellationToken)
                          ?? await GetStoredTranscriptSegmentsAsync(transcriptKey, SubtitlesKind, cancellationToken);
        if (freshStored is { Count: > 0 })
            return Ok(BaseResponse<IReadOnlyList<TranscriptSegmentDto>>.Ok(PrepareTranscriptSegments(freshStored)));

        var dto = PrepareTranscriptSegments([new TranscriptSegmentDto(0, text)]);
        return Ok(BaseResponse<IReadOnlyList<TranscriptSegmentDto>>.Ok(dto));
    }

    [HttpGet("{id:guid}/subtitles")]
    public async Task<IActionResult> GetVideoSubtitles(Guid id, CancellationToken cancellationToken)
    {
        var userId = User.GetUserId();
        var video = await GetVideoWithAccessCheckAsync(id, userId, cancellationToken);
        if (video is null)
            return NotFound(BaseResponse<IReadOnlyList<TranscriptSegmentDto>>.Fail("Video not found.", "VIDEO_NOT_FOUND"));

        var transcriptKey = $"{NormalizeSourceType(video.SourceType)}:{video.VideoId}";
        var ttl = TimeSpan.FromSeconds(_cacheOptions.TranscriptSeconds);
        var stored = await GetStoredTranscriptSegmentsAsync(transcriptKey, SubtitlesKind, cancellationToken)
                     ?? await GetStoredTranscriptSegmentsAsync(transcriptKey, TranscriptKind, cancellationToken);
        if (stored is { Count: > 0 })
        {
            var prepared = IsBilibiliVideo(video) ? PrepareTranscriptSegments(stored) : stored;
            return Ok(BaseResponse<IReadOnlyList<TranscriptSegmentDto>>.Ok(prepared));
        }

        var text = await GetOrFetchTranscriptAsync(video, cancellationToken);
        if (string.IsNullOrWhiteSpace(text))
            return NotFound(BaseResponse<IReadOnlyList<TranscriptSegmentDto>>.Fail("No captions found for this video.", "SUBTITLES_NOT_FOUND"));

        // GetOrFetchTranscriptAsync stores properly segmented data — re-read it instead of
        // collapsing everything into a single segment at t=0.
        var freshStored = await GetStoredTranscriptSegmentsAsync(transcriptKey, SubtitlesKind, cancellationToken)
                          ?? await GetStoredTranscriptSegmentsAsync(transcriptKey, TranscriptKind, cancellationToken);
        if (freshStored is { Count: > 0 })
        {
            var prepared = IsBilibiliVideo(video) ? PrepareTranscriptSegments(freshStored) : freshStored;
            return Ok(BaseResponse<IReadOnlyList<TranscriptSegmentDto>>.Ok(prepared));
        }

        var dto = IsBilibiliVideo(video)
            ? PrepareTranscriptSegments([new TranscriptSegmentDto(0, text)])
            : [new TranscriptSegmentDto(0, text)];
        return Ok(BaseResponse<IReadOnlyList<TranscriptSegmentDto>>.Ok(dto));
    }

    [HttpPatch("{id:guid}")]
    public async Task<IActionResult> UpdateVideo(Guid id, [FromBody] UpdateYouTubeVideoRequest request, CancellationToken cancellationToken)
    {
        var userId = User.GetUserId();
        var result = await _mediator.Send(new UpdateYouTubeVideoCommand(
            id, userId, request.Title, request.Summary, request.MindMapText), cancellationToken);

        if (!result.IsSuccess)
        {
            if (result.ErrorCode == "VIDEO_NOT_FOUND")
                return NotFound(BaseResponse<YouTubeVideoDto>.Fail(result.Message, result.ErrorCode));
            return BadRequest(BaseResponse<YouTubeVideoDto>.Fail(result.Message, result.ErrorCode));
        }

        return Ok(BaseResponse<YouTubeVideoDto>.Ok(result.Data!));
    }

    [HttpPatch("{id:guid}/move")]
    public async Task<IActionResult> MoveVideo(Guid id, [FromBody] MoveYouTubeVideoRequest request, CancellationToken cancellationToken)
    {
        var userId = User.GetUserId();
        var result = await _mediator.Send(new MoveYouTubeVideoCommand(id, userId, request.TargetCourseId), cancellationToken);

        if (!result.IsSuccess)
            return NotFound(BaseResponse<YouTubeVideoDto>.Fail(result.Message, result.ErrorCode));

        return Ok(BaseResponse<YouTubeVideoDto>.Ok(result.Data!));
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> DeleteVideo(Guid id, CancellationToken cancellationToken)
    {
        var userId = User.GetUserId();
        var result = await _mediator.Send(new DeleteYouTubeVideoCommand(id, userId), cancellationToken);

        if (!result.IsSuccess)
            return NotFound(BaseResponse<string>.Fail(result.Message, result.ErrorCode));

        return Ok(BaseResponse<string>.Ok("Video deleted."));
    }

    // ── Video Flashcards ──────────────────────────────────────────────────

    [HttpGet("{id:guid}/flashcards")]
    public async Task<IActionResult> GetVideoFlashcards(Guid id, CancellationToken cancellationToken)
    {
        var userId = User.GetUserId();
        var video = await GetVideoWithAccessCheckAsync(id, userId, cancellationToken);
        if (video is null)
            return NotFound(BaseResponse<IEnumerable<FlashcardDto>>.Fail("Video not found.", "VIDEO_NOT_FOUND"));

        var flashcards = await _unitOfWork.Flashcards.FindAsync(f => f.YouTubeVideoId == id && f.UserId == video.UserId, cancellationToken);
        var dtos = flashcards.Select(f => new FlashcardDto(f.FlashcardId, f.DocumentId, f.YouTubeVideoId, f.SourceType, f.UserId, f.Front, f.Back, f.CreatedAt, f.UpdatedAt,
            CardType: f.CardType, Difficulty: f.Difficulty, Chapter: f.Chapter, Tags: f.Tags)).ToList();
        return Ok(BaseResponse<IEnumerable<FlashcardDto>>.Ok(dtos));
    }

    [HttpGet("{id:guid}/notes")]
    public async Task<IActionResult> GetVideoNotes(Guid id, CancellationToken cancellationToken)
    {
        var userId = User.GetUserId();
        var video = await GetVideoWithAccessCheckAsync(id, userId, cancellationToken);
        if (video is null)
            return NotFound(BaseResponse<IEnumerable<NoteDto>>.Fail("Video not found.", "VIDEO_NOT_FOUND"));

        var notes = await _unitOfWork.Notes.FindAsync(n => n.YouTubeVideoId == id && n.UserId == video.UserId, cancellationToken);
        var dtos = notes
            .OrderByDescending(n => n.CreatedAt)
            .Select(n => new NoteDto(n.NoteId, n.UserId, n.DocumentId, n.YouTubeVideoId, n.SourceType, n.Content, n.Title, n.CreatedAt, n.UpdatedAt));
        return Ok(BaseResponse<IEnumerable<NoteDto>>.Ok(dtos));
    }

    [HttpPost("{id:guid}/flashcards/generate")]
    public async Task<IActionResult> GenerateVideoFlashcards(Guid id, [FromBody] YouTubeUrlRequest request, CancellationToken cancellationToken)
    {
        var userId = User.GetUserId();
        var video = await GetVideoWithAccessCheckAsync(id, userId, cancellationToken);
        if (video is null)
            return NotFound(BaseResponse<IEnumerable<FlashcardDto>>.Fail("Video not found.", "VIDEO_NOT_FOUND"));

        // Return cached flashcards if they already exist
        var existing = (await _unitOfWork.Flashcards.FindAsync(f => f.YouTubeVideoId == id && f.UserId == userId, cancellationToken)).ToList();
        if (existing.Count > 0)
            return Ok(BaseResponse<IEnumerable<FlashcardDto>>.Ok(
                existing.Select(f => new FlashcardDto(f.FlashcardId, f.DocumentId, f.YouTubeVideoId, f.SourceType, f.UserId, f.Front, f.Back, f.CreatedAt, f.UpdatedAt,
                    CardType: f.CardType, Difficulty: f.Difficulty, Chapter: f.Chapter, Tags: f.Tags))));

        // No cached data — fetch transcript and generate
        var transcript = await GetOrFetchTranscriptAsync(video, cancellationToken);
        if (transcript == null)
            return BadRequest(BaseResponse<IEnumerable<FlashcardDto>>.Fail("No subtitles available for this video.", "NO_TRANSCRIPT"));

        var resultJson = await _aiService.GenerateFlashcardsFromYouTubeAsync(transcript, cancellationToken);

        List<FlashcardItem> cards;
        try
        {
            cards = JsonSerializer.Deserialize<List<FlashcardItem>>(resultJson,
                new JsonSerializerOptions { PropertyNameCaseInsensitive = true }) ?? [];
        }
        catch
        {
            cards = [];
        }

        foreach (var card in cards)
        {
            var isChart = string.Equals(card.Type, "chart", StringComparison.OrdinalIgnoreCase);
            var isCloze = string.Equals(card.Type, "cloze", StringComparison.OrdinalIgnoreCase);
            var back = isChart && card.ChartData.HasValue
                ? JsonSerializer.Serialize(card.ChartData.Value)
                : card.Back;
            await _unitOfWork.Flashcards.AddAsync(new Flashcard
            {
                FlashcardId = Guid.NewGuid(),
                UserId = userId,
                YouTubeVideoId = id,
                SourceType = "video",
                Front = card.Front,
                Back = back,
                CardType = isChart ? "chart" : isCloze ? "cloze" : "basic",
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow,
            }, cancellationToken);
        }
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        var saved = await _unitOfWork.Flashcards.FindAsync(f => f.YouTubeVideoId == id && f.UserId == userId, cancellationToken);
        var savedDtos = saved.Select(f => new FlashcardDto(f.FlashcardId, f.DocumentId, f.YouTubeVideoId, f.SourceType, f.UserId, f.Front, f.Back, f.CreatedAt, f.UpdatedAt,
            CardType: f.CardType, Difficulty: f.Difficulty, Chapter: f.Chapter, Tags: f.Tags)).ToList();
        return Ok(BaseResponse<IEnumerable<FlashcardDto>>.Ok(savedDtos));
    }

    // ── Video Glossary ────────────────────────────────────────────────────

    [HttpGet("{id:guid}/glossary")]
    public async Task<IActionResult> GetVideoGlossary(Guid id, CancellationToken cancellationToken)
    {
        var userId = User.GetUserId();
        var ttl = TimeSpan.FromSeconds(_cacheOptions.GeneratedResultSeconds);
        var cacheKey = VideoGlossaryCacheKey(id, userId);

        var cached = await _cache.GetAsync<List<GlossaryTermDto>>(cacheKey, cancellationToken);
        if (cached != null)
            return Ok(BaseResponse<IEnumerable<GlossaryTermDto>>.Ok(cached));

        var terms = await _unitOfWork.GlossaryTerms.GetByVideoIdAsync(id, cancellationToken);
        var dtos = terms.Where(t => t.UserId == userId)
            .Select(t => new GlossaryTermDto(t.GlossaryTermId, null, t.Term, t.Definition, t.CreatedAt, t.YouTubeVideoId))
            .ToList();
        if (dtos.Count > 0)
            await _cache.SetAsync(cacheKey, dtos, ttl, cancellationToken);
        return Ok(BaseResponse<IEnumerable<GlossaryTermDto>>.Ok(dtos));
    }

    [HttpPost("{id:guid}/glossary/generate")]
    public async Task<IActionResult> GenerateVideoGlossary(Guid id, [FromBody] YouTubeUrlRequest request, CancellationToken cancellationToken)
    {
        var userId = User.GetUserId();
        var video = await GetVideoWithAccessCheckAsync(id, userId, cancellationToken);
        if (video is null)
            return NotFound(BaseResponse<IEnumerable<GlossaryTermDto>>.Fail("Video not found.", "VIDEO_NOT_FOUND"));

        try
        {
            // Delete existing terms and invalidate cache to allow regeneration
            await _unitOfWork.GlossaryTerms.DeleteByVideoIdAsync(id, cancellationToken);
            await _cache.RemoveAsync(VideoGlossaryCacheKey(id, userId), cancellationToken);

            var transcript = await GetOrFetchTranscriptAsync(video, cancellationToken);
            if (transcript == null)
                return BadRequest(BaseResponse<IEnumerable<GlossaryTermDto>>.Fail("No subtitles available for this video.", "NO_TRANSCRIPT"));

            var resultJson = await _aiService.GenerateGlossaryAsync(transcript, cancellationToken);

            List<GlossaryItem> items;
            try
            {
                items = System.Text.Json.JsonSerializer.Deserialize<List<GlossaryItem>>(resultJson,
                    new System.Text.Json.JsonSerializerOptions { PropertyNameCaseInsensitive = true }) ?? [];
            }
            catch
            {
                return BadRequest(BaseResponse<IEnumerable<GlossaryTermDto>>.Fail("AI returned an unexpected response format.", "PARSE_ERROR"));
            }

            foreach (var item in items)
            {
                await _unitOfWork.GlossaryTerms.AddAsync(new StudyPlatform.Domain.Entities.GlossaryTerm
                {
                    GlossaryTermId = Guid.NewGuid(),
                    UserId = userId,
                    YouTubeVideoId = id,
                    Term = item.Term,
                    Definition = item.Definition,
                    CreatedAt = DateTime.UtcNow
                }, cancellationToken);
            }
            await _unitOfWork.SaveChangesAsync(cancellationToken);

            var saved = await _unitOfWork.GlossaryTerms.GetByVideoIdAsync(id, cancellationToken);
            var dtos = saved.Where(t => t.UserId == userId)
                .Select(t => new GlossaryTermDto(t.GlossaryTermId, null, t.Term, t.Definition, t.CreatedAt, t.YouTubeVideoId))
                .ToList();
            await _cache.SetAsync(VideoGlossaryCacheKey(id, userId), dtos, TimeSpan.FromSeconds(_cacheOptions.GeneratedResultSeconds), cancellationToken);
            return Ok(BaseResponse<IEnumerable<GlossaryTermDto>>.Ok(dtos, "Glossary generated successfully."));
        }
        catch (Exception ex)
        {
            if (AiErrorMapper.TryGetAiError(ex.Message, out _, out _))
                return AiErrorMapper.ToObjectResult<IEnumerable<GlossaryTermDto>>(this, ex.Message);

            return BadRequest(BaseResponse<IEnumerable<GlossaryTermDto>>.Fail(
                $"Failed to generate glossary: {ex.Message}", "GENERATION_FAILED"));
        }
    }

    private record GlossaryItem(string Term, string Definition);

    // ── Video Quiz ────────────────────────────────────────────────────────

    [HttpGet("{id:guid}/quiz")]
    public async Task<IActionResult> GetVideoQuiz(Guid id, [FromQuery] string? difficulty, CancellationToken cancellationToken)
    {
        var userId = User.GetUserId();
        var video = await GetVideoWithAccessCheckAsync(id, userId, cancellationToken);
        if (video is null)
            return NotFound(BaseResponse<IEnumerable<QuizDto>>.Fail("Video not found.", "VIDEO_NOT_FOUND"));

        var normalizedDifficulty = string.IsNullOrWhiteSpace(difficulty) ? null : NormalizeQuizDifficulty(difficulty);
        var ttl = TimeSpan.FromSeconds(_cacheOptions.GeneratedResultSeconds);
        var cacheKey = VideoQuizCacheKey(id, video.UserId, normalizedDifficulty ?? "all");

        var cached = await _cache.GetAsync<List<QuizDto>>(cacheKey, cancellationToken);
        if (cached != null)
            return Ok(BaseResponse<IEnumerable<QuizDto>>.Ok(cached));

        var quizzes = await _unitOfWork.Quizzes.FindAsync(
            q => q.YouTubeVideoId == id && q.UserId == video.UserId && (normalizedDifficulty == null || q.Difficulty == normalizedDifficulty),
            cancellationToken);
        var dtos = quizzes.Select(q => new QuizDto(
            q.QuizId, null, q.YouTubeVideoId, q.SourceType, q.Question,
            JsonSerializer.Deserialize<string[]>(q.OptionsJson) ?? [],
            q.CorrectAnswer, q.Explanation, q.CreatedAt, q.Difficulty)).ToList();
        if (dtos.Count > 0)
            await _cache.SetAsync(cacheKey, dtos, ttl, cancellationToken);
        return Ok(BaseResponse<IEnumerable<QuizDto>>.Ok(dtos));
    }

    [HttpPost("{id:guid}/quiz/generate")]
    public async Task<IActionResult> GenerateVideoQuiz(Guid id, [FromBody] YouTubeUrlRequest request, [FromQuery] string difficulty = "medium", CancellationToken cancellationToken = default)
    {
        var userId = User.GetUserId();
        var normalizedDifficulty = NormalizeQuizDifficulty(difficulty);
        var video = await GetVideoWithAccessCheckAsync(id, userId, cancellationToken);
        if (video is null)
            return NotFound(BaseResponse<IEnumerable<QuizDto>>.Fail("Video not found.", "VIDEO_NOT_FOUND"));

        // Return cached quiz if it already exists
        var existingQuizzes = (await _unitOfWork.Quizzes.FindAsync(q => q.YouTubeVideoId == id && q.UserId == userId && q.Difficulty == normalizedDifficulty, cancellationToken)).ToList();
        if (existingQuizzes.Count > 0)
            return Ok(BaseResponse<IEnumerable<QuizDto>>.Ok(existingQuizzes.Select(q => new QuizDto(
                q.QuizId, null, q.YouTubeVideoId, q.SourceType, q.Question,
                JsonSerializer.Deserialize<string[]>(q.OptionsJson) ?? [],
                q.CorrectAnswer, q.Explanation, q.CreatedAt, q.Difficulty))));

        // No cached data — fetch transcript and generate
        var transcript = await GetOrFetchTranscriptAsync(video, cancellationToken);
        if (transcript == null)
            return BadRequest(BaseResponse<IEnumerable<QuizDto>>.Fail("No subtitles available for this video.", "NO_TRANSCRIPT"));

        var resultJson = await _aiService.GenerateQuizFromYouTubeAsync(transcript, normalizedDifficulty, cancellationToken);

        List<QuizItem> quizItems;
        try
        {
            quizItems = JsonSerializer.Deserialize<List<QuizItem>>(resultJson,
                new JsonSerializerOptions { PropertyNameCaseInsensitive = true }) ?? [];
        }
        catch
        {
            quizItems = [];
        }

        foreach (var item in quizItems)
        {
            await _unitOfWork.Quizzes.AddAsync(new Quiz
            {
                QuizId = Guid.NewGuid(),
                UserId = userId,
                YouTubeVideoId = id,
                SourceType = "video",
                Question = item.Question,
                OptionsJson = JsonSerializer.Serialize(item.Options),
                CorrectAnswer = item.CorrectAnswer,
                Explanation = item.Explanation,
                Difficulty = normalizedDifficulty,
                CreatedAt = DateTime.UtcNow
            }, cancellationToken);
        }
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        var saved = await _unitOfWork.Quizzes.FindAsync(q => q.YouTubeVideoId == id && q.UserId == userId && q.Difficulty == normalizedDifficulty, cancellationToken);
        var savedDtos = saved.Select(q => new QuizDto(
            q.QuizId, null, q.YouTubeVideoId, q.SourceType, q.Question,
            JsonSerializer.Deserialize<string[]>(q.OptionsJson) ?? [],
            q.CorrectAnswer, q.Explanation, q.CreatedAt, q.Difficulty)).ToList();
        await _cache.SetAsync(VideoQuizCacheKey(id, userId, normalizedDifficulty), savedDtos, TimeSpan.FromSeconds(_cacheOptions.GeneratedResultSeconds), cancellationToken);
        return Ok(BaseResponse<IEnumerable<QuizDto>>.Ok(savedDtos));
    }

    private static string NormalizeQuizDifficulty(string difficulty) => difficulty.ToLowerInvariant() switch
    {
        "easy" => "easy",
        "hard" => "hard",
        _ => "medium"
    };

    [HttpPost("{id:guid}/quiz/submit")]
    [ProducesResponseType(typeof(BaseResponse<QuizSubmissionDto>), 200)]
    public async Task<IActionResult> SubmitVideoQuiz(Guid id, [FromBody] SaveQuizSubmissionRequest request, CancellationToken cancellationToken)
    {
        var userId = User.GetUserId();
        var result = await _mediator.Send(
            new SaveVideoQuizSubmissionCommand(id, userId, request.Answers, request.Score, request.Total),
            cancellationToken);
        if (!result.IsSuccess)
            return NotFound(BaseResponse<QuizSubmissionDto>.Fail(result.Message, result.ErrorCode));
        return Ok(BaseResponse<QuizSubmissionDto>.Ok(result.Data!, result.Message));
    }

    [HttpGet("{id:guid}/quiz/submission")]
    [ProducesResponseType(typeof(BaseResponse<QuizSubmissionDto>), 200)]
    public async Task<IActionResult> GetVideoQuizSubmission(Guid id, CancellationToken cancellationToken)
    {
        var userId = User.GetUserId();
        var submission = await _unitOfWork.QuizSubmissions.GetByVideoAndUserAsync(id, userId, cancellationToken);
        if (submission is null)
            return Ok(BaseResponse<QuizSubmissionDto?>.Ok(null));

        var answers = System.Text.Json.JsonSerializer.Deserialize<Dictionary<string, string>>(submission.AnswersJson) ?? new();
        var dto = new QuizSubmissionDto(submission.SubmissionId, null, submission.YouTubeVideoId,
            submission.SourceType, answers, submission.Score, submission.Total, submission.SubmittedAt);
        return Ok(BaseResponse<QuizSubmissionDto>.Ok(dto));
    }

    // ── Streaming endpoints ───────────────────────────────────────────────

    [HttpPost("summary/stream")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(BaseResponse<string>), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(BaseResponse<string>), StatusCodes.Status429TooManyRequests)]
    [ProducesResponseType(typeof(BaseResponse<string>), StatusCodes.Status502BadGateway)]
    public async Task<IActionResult> StreamSummary([FromBody] YouTubeUrlRequest request, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.VideoUrl))
            return BadRequest(BaseResponse<string>.Fail("videoUrl is required.", "MISSING_VIDEO_URL"));

        var videoId = ExtractVideoId(request.VideoUrl);
        if (videoId == null)
            return BadRequest(BaseResponse<string>.Fail("Invalid YouTube URL.", "INVALID_VIDEO_URL"));

        var ttl = TimeSpan.FromSeconds(_cacheOptions.GeneratedResultSeconds);
        var cacheKey = SummaryCacheKey(videoId);
        var cached = await _cache.GetAsync<string>(cacheKey, cancellationToken);
        if (!string.IsNullOrEmpty(cached))
        {
            Response.SetSseHeaders();
            await Response.WriteSseDataAsync(cached, cancellationToken);
            await Response.WriteSseDoneAsync(cancellationToken);
            return new EmptyResult();
        }

        var transcript = await GetTranscriptTimelineTextAsync(videoId, cancellationToken);
        if (transcript == null)
            return BadRequest(BaseResponse<string>.Fail("No subtitles available for this video.", "NO_TRANSCRIPT"));

        var stream = _aiService.StreamSummaryFromYouTubeAsync(transcript, cancellationToken);
        await using var enumerator = stream.GetAsyncEnumerator(cancellationToken);

        string? firstChunk;
        try
        {
            if (!await enumerator.MoveNextAsync())
                return NoContent();

            firstChunk = enumerator.Current;
        }
        catch (OperationCanceledException)
        {
            return new EmptyResult();
        }
        catch (Exception ex)
        {
            return AiStreamError(ex);
        }

        Response.SetSseHeaders();

        var fullText = new StringBuilder();
        try
        {
            fullText.Append(firstChunk);
            await Response.WriteSseDataAsync(firstChunk, cancellationToken);

            while (await enumerator.MoveNextAsync())
            {
                var chunk = enumerator.Current;
                fullText.Append(chunk);
                await Response.WriteSseDataAsync(chunk, cancellationToken);
            }

            if (fullText.Length > 0)
                await _cache.SetAsync(cacheKey, fullText.ToString(), ttl, cancellationToken);
        }
        catch (OperationCanceledException) { return new EmptyResult(); }
        catch (Exception ex)
        {
            await Response.WriteSseDataAsync("[ERROR] " + ex.Message, cancellationToken);
        }

        await Response.WriteSseDoneAsync(cancellationToken);
        return new EmptyResult();
    }

    [HttpPost("{id:guid}/summary/stream")]
    public async Task<IActionResult> StreamVideoSummary(Guid id, CancellationToken cancellationToken)
    {
        var userId = User.GetUserId();
        var video = await GetVideoWithAccessCheckAsync(id, userId, cancellationToken);
        if (video is null)
            return NotFound(BaseResponse<string>.Fail("Video not found.", "VIDEO_NOT_FOUND"));

        var transcript = await GetOrFetchTimelineTranscriptAsync(video, cancellationToken);
        if (transcript == null)
            return BadRequest(BaseResponse<string>.Fail("No subtitles available for this video.", "NO_TRANSCRIPT"));

        var stream = _aiService.StreamSummaryFromYouTubeAsync(transcript, cancellationToken);
        await using var enumerator = stream.GetAsyncEnumerator(cancellationToken);

        string? firstChunk;
        try
        {
            if (!await enumerator.MoveNextAsync())
                return NoContent();
            firstChunk = enumerator.Current;
        }
        catch (OperationCanceledException) { return new EmptyResult(); }
        catch (Exception ex) { return AiStreamError(ex); }

        Response.SetSseHeaders();
        var fullText = new StringBuilder();
        try
        {
            fullText.Append(firstChunk);
            await Response.WriteSseDataAsync(firstChunk, cancellationToken);
            while (await enumerator.MoveNextAsync())
            {
                var chunk = enumerator.Current;
                fullText.Append(chunk);
                await Response.WriteSseDataAsync(chunk, cancellationToken);
            }

            if (fullText.Length > 0)
            {
                video.Summary = fullText.ToString();
                video.UpdatedAt = DateTime.UtcNow;
                _unitOfWork.YouTubeVideos.Update(video);
                await _unitOfWork.SaveChangesAsync(cancellationToken);
            }
        }
        catch (OperationCanceledException) { return new EmptyResult(); }
        catch (Exception ex) { await Response.WriteSseDataAsync("[ERROR] " + ex.Message, cancellationToken); }

        await Response.WriteSseDoneAsync(cancellationToken);
        return new EmptyResult();
    }

    [HttpPost("{id:guid}/chat/stream")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(BaseResponse<string>), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(BaseResponse<string>), StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(BaseResponse<string>), StatusCodes.Status429TooManyRequests)]
    [ProducesResponseType(typeof(BaseResponse<string>), StatusCodes.Status502BadGateway)]
    public async Task<IActionResult> StreamVideoChat(Guid id, [FromBody] AIChatRequest request, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.Message))
            return BadRequest(BaseResponse<string>.Fail("message is required.", "MISSING_MESSAGE"));

        var userId = User.GetUserId();
        var video = await GetVideoWithAccessCheckAsync(id, userId, cancellationToken);
        if (video is null)
            return NotFound(BaseResponse<string>.Fail("Video not found.", "VIDEO_NOT_FOUND"));

        var history = await _unitOfWork.ChatMessages.GetByYouTubeVideoIdAsync(id, userId, cancellationToken);
        var historyTuples = history.Select(m => (m.Role, m.Content)).ToList();
        var videoTranscript = await GetOrFetchTranscriptAsync(video, cancellationToken) ?? string.Empty;

        var stream = _aiService.StreamChatWithYouTubeAsync(videoTranscript, historyTuples, request.Message, cancellationToken);
        await using var enumerator = stream.GetAsyncEnumerator(cancellationToken);

        string? firstChunk;
        try
        {
            if (!await enumerator.MoveNextAsync())
                return NoContent();

            firstChunk = enumerator.Current;
        }
        catch (OperationCanceledException)
        {
            return new EmptyResult();
        }
        catch (Exception ex)
        {
            return AiStreamError(ex);
        }

        // Save user message
        var userMsg = new ChatMessage
        {
            MessageId = Guid.NewGuid(),
            YouTubeVideoId = id,
            SourceType = "video",
            UserId = userId,
            Role = "user",
            Content = request.Message,
            CreatedAt = DateTime.UtcNow
        };
        await _unitOfWork.ChatMessages.AddAsync(userMsg, cancellationToken);
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        Response.SetSseHeaders();

        var fullResponse = new StringBuilder();
        try
        {
            fullResponse.Append(firstChunk);
            await Response.WriteSseDataAsync(firstChunk, cancellationToken);

            while (await enumerator.MoveNextAsync())
            {
                var chunk = enumerator.Current;
                fullResponse.Append(chunk);
                await Response.WriteSseDataAsync(chunk, cancellationToken);
            }

            if (fullResponse.Length > 0)
            {
                var assistantMsg = new ChatMessage
                {
                    MessageId = Guid.NewGuid(),
                    YouTubeVideoId = id,
                    SourceType = "video",
                    UserId = userId,
                    Role = "assistant",
                    Content = fullResponse.ToString(),
                    CreatedAt = DateTime.UtcNow
                };
                await _unitOfWork.ChatMessages.AddAsync(assistantMsg, cancellationToken);
                await _unitOfWork.SaveChangesAsync(cancellationToken);
            }
        }
        catch (OperationCanceledException) { return new EmptyResult(); }
        catch (Exception ex)
        {
            await Response.WriteSseDataAsync("[ERROR] " + ex.Message, cancellationToken);
        }

        await Response.WriteSseDoneAsync(cancellationToken);
        return new EmptyResult();
    }

    // ── Worked Problems ───────────────────────────────────────────────────────

    [HttpGet("{id:guid}/worked-problems")]
    [ProducesResponseType(typeof(BaseResponse<IEnumerable<WorkedProblemDto>>), 200)]
    public async Task<IActionResult> GetVideoProblems(Guid id, CancellationToken cancellationToken)
    {
        var userId = User.GetUserId();
        var result = await _mediator.Send(new GetWorkedProblemsQuery(userId, null, id), cancellationToken);
        return Ok(BaseResponse<IEnumerable<WorkedProblemDto>>.Ok(result.Data!));
    }

    [HttpPost("{id:guid}/worked-problems/generate")]
    [ProducesResponseType(typeof(BaseResponse<IEnumerable<WorkedProblemDto>>), 200)]
    public async Task<IActionResult> GenerateVideoProblems(Guid id, [FromBody] GenerateWorkedProblemsRequest request, CancellationToken cancellationToken)
    {
        var userId = User.GetUserId();
        var video = await GetVideoWithAccessCheckAsync(id, userId, cancellationToken);
        if (video is null)
            return NotFound(BaseResponse<IEnumerable<WorkedProblemDto>>.Fail("Video not found.", "VIDEO_NOT_FOUND"));

        var result = await _mediator.Send(new GenerateWorkedProblemsCommand(userId, null, id, request.Difficulty, request.Count), cancellationToken);
        if (!result.IsSuccess)
        {
            if (AiErrorMapper.TryGetAiError(result.Message, out _, out _))
                return AiErrorMapper.ToObjectResult<IEnumerable<WorkedProblemDto>>(this, result.Message);
            return BadRequest(BaseResponse<IEnumerable<WorkedProblemDto>>.Fail(result.Message, result.ErrorCode));
        }
        return Ok(BaseResponse<IEnumerable<WorkedProblemDto>>.Ok(result.Data!));
    }

    private record FlashcardItem(string Front, string Back, string? Type = null, JsonElement? ChartData = null);
    private record QuizItem(string Question, string[] Options, string CorrectAnswer, string Explanation);
}
