using Microsoft.AspNetCore.Mvc;
using StudyPlatform.Application.Common;
using StudyPlatform.Application.Videos;
using StudyPlatform.Domain.Entities;

namespace StudyPlatform.API.Controllers;

// Shared access check and video-URL helpers. Transcript retrieval lives in IVideoTranscriptProvider.
public partial class VideoController
{
    // ── Access helper ─────────────────────────────────────────────────────

    private Task<Video?> GetVideoWithAccessCheckAsync(Guid id, Guid userId, CancellationToken cancellationToken)
        => _videoAccess.GetAccessibleVideoAsync(id, userId, cancellationToken);

    // ── URL helpers ───────────────────────────────────────────────────────

    private static string? ExtractVideoId(string videoUrl) => VideoUrls.ExtractVideoId(videoUrl);

    private static bool IsBilibiliVideo(Video video)
        => string.Equals(video.SourceType, "bilibili", StringComparison.OrdinalIgnoreCase);

    /// <summary>409 while an uploaded video's background transcription is still running; clients poll.</summary>
    private ObjectResult TranscriptPending<T>()
        => StatusCode(StatusCodes.Status409Conflict, BaseResponse<T>.Fail(
            "This video is still being transcribed. Long uploads can take a few minutes.", "TRANSCRIPT_PENDING"));

    /// <summary>A blob-key-safe version of a client-supplied file name (letters, digits, '.', '-', '_').</summary>
    private static string SafeBlobFileName(string fileName)
    {
        var name = Path.GetFileName(fileName);
        var safe = new string(name.Select(c => char.IsAsciiLetterOrDigit(c) || c is '.' or '-' or '_' ? c : '_').ToArray());
        return string.IsNullOrEmpty(safe.Trim('.', '_')) ? "video" : safe[..Math.Min(safe.Length, 100)];
    }
}
