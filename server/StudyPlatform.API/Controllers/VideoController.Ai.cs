using Microsoft.AspNetCore.Mvc;
using StudyPlatform.API.Extensions;
using StudyPlatform.Application.Common;
using StudyPlatform.Application.Documents.DTOs;
using StudyPlatform.Application.Services;
using StudyPlatform.Application.YouTube.Commands;

namespace StudyPlatform.API.Controllers;

// AI generation (mindmap, quiz, flashcards) & saved-video chat endpoints.
public partial class VideoController
{
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
            return await this.WriteSseCachedAsync(cached, cancellationToken);

        var transcript = await GetTranscriptTextAsync(videoId, cancellationToken);
        if (transcript == null)
            return BadRequest(BaseResponse<string>.Fail("No subtitles available for this video.", "NO_TRANSCRIPT"));

        var stream = _aiService.StreamMindMapFromYouTubeAsync(transcript, cancellationToken);
        return await this.StreamAiToSseAsync(stream, cancellationToken,
            onCompleted: (text, ct) => _cache.SetAsync(cacheKey, text, ttl, ct));
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
        return await this.StreamAiToSseAsync(stream, cancellationToken, onCompleted: async (text, ct) =>
        {
            video.MindMapText = text;
            video.UpdatedAt = DateTime.UtcNow;
            _unitOfWork.YouTubeVideos.Update(video);
            await _unitOfWork.SaveChangesAsync(ct);
        });
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
        var dtos = new List<ChatMessageDto>();
        foreach (var m in messages)
            dtos.Add(await m.ToDtoAsync(_blobStorageService, cancellationToken));
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

}
