using Microsoft.AspNetCore.Mvc;
using StudyPlatform.Application.Common;

namespace StudyPlatform.API.Controllers;

// Transcript, subtitles, metadata & playlist endpoints.
public partial class VideoController
{
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

}
