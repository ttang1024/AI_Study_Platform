using StudyPlatform.Application.Videos.Transcripts;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using StudyPlatform.API.Extensions;
using StudyPlatform.API.Services;
using StudyPlatform.Application.Common;
using StudyPlatform.Application.Videos;
using StudyPlatform.Application.Videos.Commands;
using StudyPlatform.Application.Videos.DTOs;
using StudyPlatform.Application.Videos.Queries;

namespace StudyPlatform.API.Controllers;

// Video library CRUD, upload, playback, file & thumbnail endpoints.
public partial class VideoController
{
    // ── Video library (CRUD) ──────────────────────────────────────────────

    [HttpPost]
    public async Task<IActionResult> SaveVideo([FromBody] SaveVideoRequest request, CancellationToken cancellationToken)
    {
        var userId = User.GetUserId();
        var result = await _mediator.Send(new SaveVideoCommand(
            userId, request.CourseId, request.VideoId,
            request.VideoUrl, request.SourceType, request.Title, request.ThumbnailUrl, request.Summary), cancellationToken);

        if (!result.IsSuccess)
            return BadRequest(BaseResponse<VideoDto>.Fail(result.Message, result.ErrorCode));

        return Ok(BaseResponse<VideoDto>.Ok(result.Data!));
    }

    [HttpPost("upload")]
    [RequestSizeLimit(524288000)] // 500 MB
    public async Task<IActionResult> UploadVideo(
        [FromForm] Guid courseId,
        IFormFile file,
        IFormFile? thumbnail,
        [FromServices] TranscriptionQueue transcriptionQueue,
        CancellationToken cancellationToken)
    {
        if (file == null || file.Length == 0)
            return BadRequest(BaseResponse<VideoDto>.Fail("No file provided.", "NO_FILE"));

        var userId = User.GetUserId();

        // ASP.NET has already spooled the multipart body to disk; the handler streams it on to storage.
        await using var fileStream = file.OpenReadStream();
        await using var thumbnailStream = thumbnail is { Length: > 0 } ? thumbnail.OpenReadStream() : null;
        var result = await _mediator.Send(new UploadVideoCommand(
            userId,
            courseId,
            new UploadedFile(fileStream, file.FileName, file.ContentType, file.Length),
            thumbnailStream == null ? null : new UploadedFile(thumbnailStream, thumbnail!.FileName, thumbnail.ContentType, thumbnail.Length)),
            cancellationToken);

        if (!result.IsSuccess)
            return BadRequest(BaseResponse<VideoDto>.Fail(result.Message, result.ErrorCode));

        transcriptionQueue.TryEnqueue(result.Data!.Id, userId, TranscriptionJobKind.UploadedVideo);
        return StatusCode(StatusCodes.Status201Created, BaseResponse<VideoDto>.Ok(result.Data!));
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

        // Redirect rather than proxy: a video is hundreds of MB and seeking issues many range requests,
        // all of which used to stream through the single API instance.
        return Redirect(await _blobStorageService.GetMediaUrlAsync(
            video.VideoUrl, MediaFormatting.GetVideoContentType(video.VideoUrl), cancellationToken: cancellationToken));
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

        var ext = Path.GetExtension(video.ThumbnailUrl).ToLowerInvariant();
        var contentType = ext == ".png" ? "image/png" : ext == ".webp" ? "image/webp" : "image/jpeg";
        return Redirect(await _blobStorageService.GetMediaUrlAsync(video.ThumbnailUrl, contentType, cancellationToken: cancellationToken));
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
        var result = await _mediator.Send(new GetVideosQuery(userId, courseId, search, page, pageSize), cancellationToken);
        return Ok(BaseResponse<VideoPagedResult>.Ok(result.Data!));
    }

    // Lightweight list (no summary/mind-map) for callers that fetch all of a user's
    // videos just to label other content. Far smaller payload than GET /api/videos.
    [HttpGet("lite")]
    public async Task<IActionResult> GetVideosLite(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 500,
        CancellationToken cancellationToken = default)
    {
        var userId = User.GetUserId();
        var result = await _mediator.Send(new GetVideosLiteQuery(userId, page, pageSize), cancellationToken);
        return Ok(BaseResponse<VideoLitePagedResult>.Ok(result.Data!));
    }

    [HttpGet("{id:guid}")]
    public async Task<IActionResult> GetVideo(Guid id, CancellationToken cancellationToken)
    {
        var userId = User.GetUserId();
        var result = await _mediator.Send(new GetVideoByIdQuery(id, userId), cancellationToken);

        if (!result.IsSuccess)
            return NotFound(BaseResponse<VideoDto>.Fail(result.Message, result.ErrorCode));

        return Ok(BaseResponse<VideoDto>.Ok(result.Data!));
    }

    [HttpGet("{id:guid}/transcript")]
    public async Task<IActionResult> GetVideoTranscript(Guid id, CancellationToken cancellationToken)
    {
        var userId = User.GetUserId();
        var video = await GetVideoWithAccessCheckAsync(id, userId, cancellationToken);
        if (video is null)
            return NotFound(BaseResponse<IReadOnlyList<TranscriptSegmentDto>>.Fail("Video not found.", "VIDEO_NOT_FOUND"));

        var transcriptKey = $"{VideoSourceTypes.Normalize(video.SourceType)}:{video.ExternalVideoId}";
        var ttl = TimeSpan.FromSeconds(_cacheOptions.TranscriptSeconds);
        var stored = await _transcripts.GetStoredSegmentsAsync(transcriptKey, TranscriptKinds.Transcript, cancellationToken)
                     ?? await _transcripts.GetStoredSegmentsAsync(transcriptKey, TranscriptKinds.Subtitles, cancellationToken);
        if (stored is { Count: > 0 })
            return Ok(BaseResponse<IReadOnlyList<TranscriptSegmentDto>>.Ok(TranscriptSegmentation.Prepare(stored)));

        if (video.TranscriptionRequestedAt != null && string.IsNullOrEmpty(video.Transcript))
            return TranscriptPending<IReadOnlyList<TranscriptSegmentDto>>();

        var text = await _transcripts.GetOrFetchTranscriptAsync(video, cancellationToken);
        if (string.IsNullOrWhiteSpace(text))
            return NotFound(BaseResponse<IReadOnlyList<TranscriptSegmentDto>>.Fail("No captions found for this video.", "TRANSCRIPT_NOT_FOUND"));

        // GetOrFetchTranscriptAsync stores properly segmented data — re-read it instead of
        // collapsing everything into a single segment at t=0.
        var freshStored = await _transcripts.GetStoredSegmentsAsync(transcriptKey, TranscriptKinds.Transcript, cancellationToken)
                          ?? await _transcripts.GetStoredSegmentsAsync(transcriptKey, TranscriptKinds.Subtitles, cancellationToken);
        if (freshStored is { Count: > 0 })
            return Ok(BaseResponse<IReadOnlyList<TranscriptSegmentDto>>.Ok(TranscriptSegmentation.Prepare(freshStored)));

        var dto = TranscriptSegmentation.Prepare([new TranscriptSegmentDto(0, text)]);
        return Ok(BaseResponse<IReadOnlyList<TranscriptSegmentDto>>.Ok(dto));
    }

    [HttpGet("{id:guid}/subtitles")]
    public async Task<IActionResult> GetVideoSubtitles(Guid id, CancellationToken cancellationToken)
    {
        var userId = User.GetUserId();
        var video = await GetVideoWithAccessCheckAsync(id, userId, cancellationToken);
        if (video is null)
            return NotFound(BaseResponse<IReadOnlyList<TranscriptSegmentDto>>.Fail("Video not found.", "VIDEO_NOT_FOUND"));

        var transcriptKey = $"{VideoSourceTypes.Normalize(video.SourceType)}:{video.ExternalVideoId}";
        var ttl = TimeSpan.FromSeconds(_cacheOptions.TranscriptSeconds);
        var stored = await _transcripts.GetStoredSegmentsAsync(transcriptKey, TranscriptKinds.Subtitles, cancellationToken)
                     ?? await _transcripts.GetStoredSegmentsAsync(transcriptKey, TranscriptKinds.Transcript, cancellationToken);
        if (stored is { Count: > 0 })
        {
            var prepared = IsBilibiliVideo(video) ? TranscriptSegmentation.Prepare(stored) : stored;
            return Ok(BaseResponse<IReadOnlyList<TranscriptSegmentDto>>.Ok(prepared));
        }

        var text = await _transcripts.GetOrFetchTranscriptAsync(video, cancellationToken);
        if (string.IsNullOrWhiteSpace(text))
            return NotFound(BaseResponse<IReadOnlyList<TranscriptSegmentDto>>.Fail("No captions found for this video.", "SUBTITLES_NOT_FOUND"));

        // GetOrFetchTranscriptAsync stores properly segmented data — re-read it instead of
        // collapsing everything into a single segment at t=0.
        var freshStored = await _transcripts.GetStoredSegmentsAsync(transcriptKey, TranscriptKinds.Subtitles, cancellationToken)
                          ?? await _transcripts.GetStoredSegmentsAsync(transcriptKey, TranscriptKinds.Transcript, cancellationToken);
        if (freshStored is { Count: > 0 })
        {
            var prepared = IsBilibiliVideo(video) ? TranscriptSegmentation.Prepare(freshStored) : freshStored;
            return Ok(BaseResponse<IReadOnlyList<TranscriptSegmentDto>>.Ok(prepared));
        }

        var dto = IsBilibiliVideo(video)
            ? TranscriptSegmentation.Prepare([new TranscriptSegmentDto(0, text)])
            : [new TranscriptSegmentDto(0, text)];
        return Ok(BaseResponse<IReadOnlyList<TranscriptSegmentDto>>.Ok(dto));
    }

    [HttpPatch("{id:guid}")]
    public async Task<IActionResult> UpdateVideo(Guid id, [FromBody] UpdateVideoRequest request, CancellationToken cancellationToken)
    {
        var userId = User.GetUserId();
        var result = await _mediator.Send(new UpdateVideoCommand(
            id, userId, request.Title, request.Summary, request.MindMapText), cancellationToken);

        if (!result.IsSuccess)
        {
            if (result.ErrorCode == "VIDEO_NOT_FOUND")
                return NotFound(BaseResponse<VideoDto>.Fail(result.Message, result.ErrorCode));
            return BadRequest(BaseResponse<VideoDto>.Fail(result.Message, result.ErrorCode));
        }

        return Ok(BaseResponse<VideoDto>.Ok(result.Data!));
    }

    [HttpPatch("{id:guid}/move")]
    public async Task<IActionResult> MoveVideo(Guid id, [FromBody] MoveVideoRequest request, CancellationToken cancellationToken)
    {
        var userId = User.GetUserId();
        var result = await _mediator.Send(new MoveVideoCommand(id, userId, request.TargetCourseId), cancellationToken);

        if (!result.IsSuccess)
            return NotFound(BaseResponse<VideoDto>.Fail(result.Message, result.ErrorCode));

        return Ok(BaseResponse<VideoDto>.Ok(result.Data!));
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> DeleteVideo(Guid id, CancellationToken cancellationToken)
    {
        var userId = User.GetUserId();
        var result = await _mediator.Send(new DeleteVideoCommand(id, userId), cancellationToken);

        if (!result.IsSuccess)
            return NotFound(BaseResponse<string>.Fail(result.Message, result.ErrorCode));

        return Ok(BaseResponse<string>.Ok("Video deleted."));
    }

}
