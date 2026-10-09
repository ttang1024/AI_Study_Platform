using StudyPlatform.Application.Videos.Transcripts;
using StudyPlatform.Domain.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using StudyPlatform.API.Extensions;
using StudyPlatform.API.Services;
using StudyPlatform.Application.Common;
using StudyPlatform.Application.Videos;
using StudyPlatform.Application.Videos.Commands;
using StudyPlatform.Application.Videos.DTOs;
using StudyPlatform.Application.Videos.Queries;
using StudyPlatform.Domain.Entities;

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

        var ext = Path.GetExtension(file.FileName).ToLowerInvariant();
        var allowedExtensions = new[]
        {
            ".mp4", ".mov", ".m4v", ".webm", ".mkv", ".avi",
            ".wmv", ".flv", ".3gp", ".3g2", ".ts", ".mts", ".m2ts", ".mpg", ".mpeg", ".ogv",
            ".vob", ".asf",
        };
        if (!file.ContentType.StartsWith("video/", StringComparison.OrdinalIgnoreCase) && !allowedExtensions.Contains(ext))
            return BadRequest(BaseResponse<VideoDto>.Fail("File type not supported. Allowed: MP4, MOV, WEBM, MKV, AVI, WMV, FLV, 3GP, TS, MPG, OGV, VOB, ASF.", "INVALID_FILE_TYPE"));

        var userId = User.GetUserId();
        var course = await _unitOfWork.Courses.GetOwnedAsync(courseId, userId, cancellationToken);
        if (course == null)
            return BadRequest(BaseResponse<VideoDto>.Fail("Course not found.", "COURSE_NOT_FOUND"));

        if (_limits.VideoUploadLimit >= 0)
        {
            var count = await _unitOfWork.Videos.CountAsync(
                v => v.UserId == userId && v.SourceType == "upload",
                cancellationToken);
            if (count >= _limits.VideoUploadLimit)
                return BadRequest(BaseResponse<VideoDto>.Fail(
                    $"Upload limit of {_limits.VideoUploadLimit} videos per account reached.",
                    "VIDEO_LIMIT_REACHED"));
        }

        // Streamed straight to storage: ASP.NET has already spooled the multipart body to disk, so the
        // file is never held in memory here. The client's file name is display-only; the blob key uses a
        // sanitised copy of it.
        var blobUrl = string.Empty;
        await using (var fileStream = file.OpenReadStream())
        {
            var blobName = $"{userId}/{courseId}/videos/{Guid.NewGuid()}_{SafeBlobFileName(file.FileName)}";
            blobUrl = await _blobStorageService.UploadAsync(fileStream, blobName, file.ContentType, cancellationToken);
        }

        var thumbnailUrl = string.Empty;
        if (thumbnail is { Length: > 0 } && thumbnail.ContentType.StartsWith("image/", StringComparison.OrdinalIgnoreCase))
        {
            var thumbnailExt = Path.GetExtension(thumbnail.FileName).ToLowerInvariant();
            if (thumbnailExt is not (".png" or ".jpg" or ".jpeg" or ".webp"))
                thumbnailExt = ".jpg";

            await using var thumbnailStream = thumbnail.OpenReadStream();
            var thumbnailBlobName = $"{userId}/{courseId}/videos/covers/{Guid.NewGuid()}{thumbnailExt}";
            thumbnailUrl = await _blobStorageService.UploadAsync(thumbnailStream, thumbnailBlobName, thumbnail.ContentType, cancellationToken);
        }

        var video = new Video
        {
            VideoId = Guid.NewGuid(),
            UserId = userId,
            CourseId = courseId,
            ExternalVideoId = $"upload-{Guid.NewGuid():N}",
            VideoUrl = blobUrl,
            SourceType = "upload",
            Title = Path.GetFileNameWithoutExtension(file.FileName),
            ThumbnailUrl = thumbnailUrl,
            // Transcribed in the background (Whisper on a long video takes minutes — far past the
            // CDN's request timeout); the marker is what the transcript endpoint reports as pending.
            TranscriptionRequestedAt = DateTime.UtcNow,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
        };

        await _unitOfWork.Videos.AddAsync(video, cancellationToken);
        await _unitOfWork.SaveChangesAsync(cancellationToken);
        transcriptionQueue.TryEnqueue(video.VideoId, userId, TranscriptionJobKind.UploadedVideo);

        var saved = await _unitOfWork.Videos.GetByIdForUserAsync(video.VideoId, userId, cancellationToken);
        return StatusCode(StatusCodes.Status201Created, BaseResponse<VideoDto>.Ok(SaveVideoCommandHandler.ToDto(saved!)));
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
