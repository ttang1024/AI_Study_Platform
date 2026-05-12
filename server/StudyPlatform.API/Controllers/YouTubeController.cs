using System.Text;
using System.Text.Json;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Options;
using StudyPlatform.API.Extensions;
using StudyPlatform.Application.Common;
using StudyPlatform.Application.Documents.DTOs;
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

namespace StudyPlatform.API.Controllers;

public record TranscriptSegmentDto(double StartSeconds, string Text);
public record PlaylistVideoItemDto(string VideoId, string Title, string ThumbnailUrl);
public record YouTubeUrlRequest(string VideoUrl);
public record YouTubeChatRequest(string VideoUrl, string Message, IEnumerable<ChatHistoryEntry> History);
public record ChatHistoryEntry(string Role, string Content);

[ApiController]
[Route("api/youtube")]
[Authorize]
[Produces("application/json")]
public class YouTubeController : ControllerBase
{
    private readonly IYouTubeTranscriptService _transcriptService;
    private readonly IAiService _aiService;
    private readonly IMediator _mediator;
    private readonly IUnitOfWork _unitOfWork;
    private readonly IAppCache _cache;
    private readonly CacheOptions _cacheOptions;

    public YouTubeController(IYouTubeTranscriptService transcriptService, IAiService aiService, IMediator mediator, IUnitOfWork unitOfWork, IAppCache cache, IOptions<CacheOptions> cacheOptions)
    {
        _transcriptService = transcriptService;
        _aiService = aiService;
        _mediator = mediator;
        _unitOfWork = unitOfWork;
        _cache = cache;
        _cacheOptions = cacheOptions.Value;
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
            return Ok(BaseResponse<IReadOnlyList<TranscriptSegmentDto>>.Ok(cached, "Transcript retrieved successfully."));

        var segments = await _transcriptService.GetTranscriptAsync(videoId, cancellationToken);
        if (segments == null)
            return NotFound(BaseResponse<string>.Fail(
                "No captions found for this video.", "TRANSCRIPT_NOT_FOUND"));

        var dtos = segments.Select(s => new TranscriptSegmentDto(s.Start.TotalSeconds, s.Text)).ToList();
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

        var segments = await _transcriptService.GetSubtitlesAsync(videoId, cancellationToken);
        if (segments == null)
            return NotFound(BaseResponse<string>.Fail(
                "No captions found for this video.", "SUBTITLES_NOT_FOUND"));

        var dtos = segments.Select(s => new TranscriptSegmentDto(s.Start.TotalSeconds, s.Text)).ToList();
        await _cache.SetAsync(cacheKey, dtos, ttl, cancellationToken);
        return Ok(BaseResponse<IReadOnlyList<TranscriptSegmentDto>>.Ok(dtos, "Subtitles retrieved successfully."));
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

    // Returns transcript from Redis → DB → YouTube fetch (in that order), persisting to DB and Redis on miss.
    private async Task<string?> GetOrFetchTranscriptAsync(YouTubeVideo video, CancellationToken cancellationToken)
    {
        var cacheKey = TranscriptCacheKey(video.VideoId);
        var ttl = TimeSpan.FromSeconds(_cacheOptions.TranscriptSeconds);

        var cached = await _cache.GetAsync<string>(cacheKey, cancellationToken);
        if (!string.IsNullOrEmpty(cached))
            return cached;

        if (!string.IsNullOrEmpty(video.Transcript))
        {
            await _cache.SetAsync(cacheKey, video.Transcript, ttl, cancellationToken);
            return video.Transcript;
        }

        var segments = await _transcriptService.GetSubtitlesAsync(video.VideoId, cancellationToken)
                       ?? await _transcriptService.GetTranscriptAsync(video.VideoId, cancellationToken);
        if (segments == null || segments.Count == 0) return null;

        var transcript = string.Join(" ", segments.Select(s => s.Text));
        video.Transcript = transcript;
        video.UpdatedAt = DateTime.UtcNow;
        _unitOfWork.YouTubeVideos.Update(video);
        await _unitOfWork.SaveChangesAsync(cancellationToken);
        await _cache.SetAsync(cacheKey, transcript, ttl, cancellationToken);
        return transcript;
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

        var segments = await _transcriptService.GetSubtitlesAsync(videoId, cancellationToken)
                       ?? await _transcriptService.GetTranscriptAsync(videoId, cancellationToken);
        if (segments == null || segments.Count == 0) return null;

        var transcript = string.Join(" ", segments.Select(s => s.Text));
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

        var segments = await _transcriptService.GetSubtitlesAsync(videoId, cancellationToken)
                       ?? await _transcriptService.GetTranscriptAsync(videoId, cancellationToken);
        if (segments is { Count: > 0 })
        {
            var dtos = segments.Select(s => new TranscriptSegmentDto(s.Start.TotalSeconds, s.Text)).ToList();
            await _cache.SetAsync(cacheKey, dtos, ttl, cancellationToken);
            return FormatTranscriptSegments(dtos);
        }

        return await GetTranscriptTextAsync(videoId, cancellationToken);
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
            Response.ContentType = "text/event-stream";
            Response.Headers["Cache-Control"] = "no-cache";
            Response.Headers["X-Accel-Buffering"] = "no";
            await WriteSseDataAsync(cached, cancellationToken);
            await Response.WriteAsync("data: [DONE]\n\n", cancellationToken);
            await Response.Body.FlushAsync(cancellationToken);
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

        Response.ContentType = "text/event-stream";
        Response.Headers["Cache-Control"] = "no-cache";
        Response.Headers["X-Accel-Buffering"] = "no";

        var fullText = new StringBuilder();
        try
        {
            fullText.Append(firstChunk);
            await WriteSseDataAsync(firstChunk, cancellationToken);

            while (await enumerator.MoveNextAsync())
            {
                var chunk = enumerator.Current;
                fullText.Append(chunk);
                await WriteSseDataAsync(chunk, cancellationToken);
            }

            if (fullText.Length > 0)
                await _cache.SetAsync(cacheKey, fullText.ToString(), ttl, cancellationToken);
        }
        catch (OperationCanceledException) { return new EmptyResult(); }
        catch (Exception ex)
        {
            await WriteSseDataAsync("[ERROR] " + ex.Message, cancellationToken);
        }

        await Response.WriteAsync("data: [DONE]\n\n", cancellationToken);
        await Response.Body.FlushAsync(cancellationToken);
        return new EmptyResult();
    }

    private async Task WriteSseDataAsync(string data, CancellationToken cancellationToken)
    {
        await Response.WriteAsync($"data: {JsonSerializer.Serialize(data)}\n\n", cancellationToken);
        await Response.Body.FlushAsync(cancellationToken);
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

    [HttpPost("videos/{id:guid}/chat")]
    [ProducesResponseType(typeof(BaseResponse<ChatMessageDto>), 200)]
    public async Task<IActionResult> VideoChat(Guid id, [FromBody] AIChatRequest request, CancellationToken cancellationToken)
    {
        var userId = User.GetUserId();
        var result = await _mediator.Send(new AIVideoChatCommand(id, userId, request.Message), cancellationToken);
        if (!result.IsSuccess)
            return NotFound(BaseResponse<ChatMessageDto>.Fail(result.Message, result.ErrorCode));
        return Ok(BaseResponse<ChatMessageDto>.Ok(result.Data!, result.Message));
    }

    [HttpGet("videos/{id:guid}/chat")]
    [ProducesResponseType(typeof(BaseResponse<IEnumerable<ChatMessageDto>>), 200)]
    public async Task<IActionResult> GetVideoChatHistory(Guid id, CancellationToken cancellationToken)
    {
        var userId = User.GetUserId();
        var result = await _mediator.Send(new GetVideoChatHistoryQuery(id, userId), cancellationToken);
        if (!result.IsSuccess)
            return NotFound(BaseResponse<IEnumerable<ChatMessageDto>>.Fail(result.Message, result.ErrorCode));
        return Ok(BaseResponse<IEnumerable<ChatMessageDto>>.Ok(result.Data!));
    }

    [HttpDelete("videos/{id:guid}/chat")]
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

    [HttpPost("videos")]
    public async Task<IActionResult> SaveVideo([FromBody] SaveYouTubeVideoRequest request, CancellationToken cancellationToken)
    {
        var userId = User.GetUserId();
        var result = await _mediator.Send(new SaveYouTubeVideoCommand(
            userId, request.CourseId, request.VideoId,
            request.VideoUrl, request.Title, request.ThumbnailUrl, request.Summary), cancellationToken);

        if (!result.IsSuccess)
            return BadRequest(BaseResponse<YouTubeVideoDto>.Fail(result.Message, result.ErrorCode));

        return Ok(BaseResponse<YouTubeVideoDto>.Ok(result.Data!));
    }

    [HttpGet("videos")]
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

    [HttpGet("videos/{id:guid}")]
    public async Task<IActionResult> GetVideo(Guid id, CancellationToken cancellationToken)
    {
        var userId = User.GetUserId();
        var result = await _mediator.Send(new GetYouTubeVideoByIdQuery(id, userId), cancellationToken);

        if (!result.IsSuccess)
            return NotFound(BaseResponse<YouTubeVideoDto>.Fail(result.Message, result.ErrorCode));

        return Ok(BaseResponse<YouTubeVideoDto>.Ok(result.Data!));
    }

    [HttpPatch("videos/{id:guid}")]
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

    [HttpPatch("videos/{id:guid}/move")]
    public async Task<IActionResult> MoveVideo(Guid id, [FromBody] MoveYouTubeVideoRequest request, CancellationToken cancellationToken)
    {
        var userId = User.GetUserId();
        var result = await _mediator.Send(new MoveYouTubeVideoCommand(id, userId, request.TargetCourseId), cancellationToken);

        if (!result.IsSuccess)
            return NotFound(BaseResponse<YouTubeVideoDto>.Fail(result.Message, result.ErrorCode));

        return Ok(BaseResponse<YouTubeVideoDto>.Ok(result.Data!));
    }

    [HttpDelete("videos/{id:guid}")]
    public async Task<IActionResult> DeleteVideo(Guid id, CancellationToken cancellationToken)
    {
        var userId = User.GetUserId();
        var result = await _mediator.Send(new DeleteYouTubeVideoCommand(id, userId), cancellationToken);

        if (!result.IsSuccess)
            return NotFound(BaseResponse<string>.Fail(result.Message, result.ErrorCode));

        return Ok(BaseResponse<string>.Ok("Video deleted."));
    }

    // ── Video Flashcards ──────────────────────────────────────────────────

    [HttpGet("videos/{id:guid}/flashcards")]
    public async Task<IActionResult> GetVideoFlashcards(Guid id, CancellationToken cancellationToken)
    {
        var userId = User.GetUserId();
        var ttl = TimeSpan.FromSeconds(_cacheOptions.GeneratedResultSeconds);
        var cacheKey = VideoFlashcardsCacheKey(id, userId);

        var cached = await _cache.GetAsync<List<FlashcardDto>>(cacheKey, cancellationToken);
        if (cached != null)
            return Ok(BaseResponse<IEnumerable<FlashcardDto>>.Ok(cached));

        var flashcards = await _unitOfWork.Flashcards.FindAsync(f => f.YouTubeVideoId == id && f.UserId == userId, cancellationToken);
        var dtos = flashcards.Select(f => new FlashcardDto(f.FlashcardId, f.DocumentId, f.YouTubeVideoId, f.SourceType, f.UserId, f.Front, f.Back, f.CreatedAt, f.UpdatedAt)).ToList();
        if (dtos.Count > 0)
            await _cache.SetAsync(cacheKey, dtos, ttl, cancellationToken);
        return Ok(BaseResponse<IEnumerable<FlashcardDto>>.Ok(dtos));
    }

    [HttpPost("videos/{id:guid}/flashcards/generate")]
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
                existing.Select(f => new FlashcardDto(f.FlashcardId, f.DocumentId, f.YouTubeVideoId, f.SourceType, f.UserId, f.Front, f.Back, f.CreatedAt, f.UpdatedAt))));

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
            await _unitOfWork.Flashcards.AddAsync(new Flashcard
            {
                FlashcardId = Guid.NewGuid(),
                UserId = userId,
                YouTubeVideoId = id,
                SourceType = "video",
                Front = card.Front,
                Back = card.Back,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            }, cancellationToken);
        }
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        var saved = await _unitOfWork.Flashcards.FindAsync(f => f.YouTubeVideoId == id && f.UserId == userId, cancellationToken);
        var savedDtos = saved.Select(f => new FlashcardDto(f.FlashcardId, f.DocumentId, f.YouTubeVideoId, f.SourceType, f.UserId, f.Front, f.Back, f.CreatedAt, f.UpdatedAt)).ToList();
        await _cache.SetAsync(VideoFlashcardsCacheKey(id, userId), savedDtos, TimeSpan.FromSeconds(_cacheOptions.GeneratedResultSeconds), cancellationToken);
        return Ok(BaseResponse<IEnumerable<FlashcardDto>>.Ok(savedDtos));
    }

    // ── Video Glossary ────────────────────────────────────────────────────

    [HttpGet("videos/{id:guid}/glossary")]
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

    [HttpPost("videos/{id:guid}/glossary/generate")]
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

    [HttpGet("videos/{id:guid}/quiz")]
    public async Task<IActionResult> GetVideoQuiz(Guid id, [FromQuery] string? difficulty, CancellationToken cancellationToken)
    {
        var userId = User.GetUserId();
        var normalizedDifficulty = string.IsNullOrWhiteSpace(difficulty) ? null : NormalizeQuizDifficulty(difficulty);
        var ttl = TimeSpan.FromSeconds(_cacheOptions.GeneratedResultSeconds);
        var cacheKey = VideoQuizCacheKey(id, userId, normalizedDifficulty ?? "all");

        var cached = await _cache.GetAsync<List<QuizDto>>(cacheKey, cancellationToken);
        if (cached != null)
            return Ok(BaseResponse<IEnumerable<QuizDto>>.Ok(cached));

        var quizzes = await _unitOfWork.Quizzes.FindAsync(
            q => q.YouTubeVideoId == id && q.UserId == userId && (normalizedDifficulty == null || q.Difficulty == normalizedDifficulty),
            cancellationToken);
        var dtos = quizzes.Select(q => new QuizDto(
            q.QuizId, null, q.YouTubeVideoId, q.SourceType, q.Question,
            JsonSerializer.Deserialize<string[]>(q.OptionsJson) ?? [],
            q.CorrectAnswer, q.Explanation, q.CreatedAt, q.Difficulty)).ToList();
        if (dtos.Count > 0)
            await _cache.SetAsync(cacheKey, dtos, ttl, cancellationToken);
        return Ok(BaseResponse<IEnumerable<QuizDto>>.Ok(dtos));
    }

    [HttpPost("videos/{id:guid}/quiz/generate")]
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

    [HttpPost("videos/{id:guid}/quiz/submit")]
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

    [HttpGet("videos/{id:guid}/quiz/submission")]
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
            Response.ContentType = "text/event-stream";
            Response.Headers["Cache-Control"] = "no-cache";
            Response.Headers["X-Accel-Buffering"] = "no";
            await WriteSseDataAsync(cached, cancellationToken);
            await Response.WriteAsync("data: [DONE]\n\n", cancellationToken);
            await Response.Body.FlushAsync(cancellationToken);
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

        Response.ContentType = "text/event-stream";
        Response.Headers["Cache-Control"] = "no-cache";
        Response.Headers["X-Accel-Buffering"] = "no";

        var fullText = new StringBuilder();
        try
        {
            fullText.Append(firstChunk);
            await WriteSseDataAsync(firstChunk, cancellationToken);

            while (await enumerator.MoveNextAsync())
            {
                var chunk = enumerator.Current;
                fullText.Append(chunk);
                await WriteSseDataAsync(chunk, cancellationToken);
            }

            if (fullText.Length > 0)
                await _cache.SetAsync(cacheKey, fullText.ToString(), ttl, cancellationToken);
        }
        catch (OperationCanceledException) { return new EmptyResult(); }
        catch (Exception ex)
        {
            await WriteSseDataAsync("[ERROR] " + ex.Message, cancellationToken);
        }

        await Response.WriteAsync("data: [DONE]\n\n", cancellationToken);
        await Response.Body.FlushAsync(cancellationToken);
        return new EmptyResult();
    }

    [HttpPost("videos/{id:guid}/chat/stream")]
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

        Response.ContentType = "text/event-stream";
        Response.Headers["Cache-Control"] = "no-cache";
        Response.Headers["X-Accel-Buffering"] = "no";

        var fullResponse = new StringBuilder();
        try
        {
            fullResponse.Append(firstChunk);
            await WriteSseDataAsync(firstChunk, cancellationToken);

            while (await enumerator.MoveNextAsync())
            {
                var chunk = enumerator.Current;
                fullResponse.Append(chunk);
                await WriteSseDataAsync(chunk, cancellationToken);
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
            await WriteSseDataAsync("[ERROR] " + ex.Message, cancellationToken);
        }

        await Response.WriteAsync("data: [DONE]\n\n", cancellationToken);
        await Response.Body.FlushAsync(cancellationToken);
        return new EmptyResult();
    }

    // ── Worked Problems ───────────────────────────────────────────────────────

    [HttpGet("videos/{id:guid}/worked-problems")]
    [ProducesResponseType(typeof(BaseResponse<IEnumerable<WorkedProblemDto>>), 200)]
    public async Task<IActionResult> GetVideoProblems(Guid id, CancellationToken cancellationToken)
    {
        var userId = User.GetUserId();
        var result = await _mediator.Send(new GetWorkedProblemsQuery(userId, null, id), cancellationToken);
        return Ok(BaseResponse<IEnumerable<WorkedProblemDto>>.Ok(result.Data!));
    }

    [HttpPost("videos/{id:guid}/worked-problems/generate")]
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

    private record FlashcardItem(string Front, string Back);
    private record QuizItem(string Question, string[] Options, string CorrectAnswer, string Explanation);
}
