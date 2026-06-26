using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using StudyPlatform.API.Extensions;
using StudyPlatform.Application.Common;
using StudyPlatform.Application.YouTube.Commands;
using StudyPlatform.Application.YouTube.DTOs;
using StudyPlatform.Application.YouTube.Queries;
using StudyPlatform.Domain.Entities;

namespace StudyPlatform.API.Controllers;

// Video library CRUD, upload, playback, file & thumbnail endpoints.
public partial class VideoController
{
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
        IFormFile file,
        IFormFile? thumbnail,
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
        return File(stream, MediaFormatting.GetVideoContentType(video.VideoUrl), enableRangeProcessing: true);
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

    // Lightweight list (no summary/mind-map) for callers that fetch all of a user's
    // videos just to label other content. Far smaller payload than GET /api/videos.
    [HttpGet("lite")]
    public async Task<IActionResult> GetVideosLite(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 500,
        CancellationToken cancellationToken = default)
    {
        var userId = User.GetUserId();
        var result = await _mediator.Send(new GetYouTubeVideosLiteQuery(userId, page, pageSize), cancellationToken);
        return Ok(BaseResponse<YouTubeVideoLitePagedResult>.Ok(result.Data!));
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

}
