using Microsoft.AspNetCore.Mvc;
using System.Text.RegularExpressions;
using StudyPlatform.API.Extensions;
using StudyPlatform.Application.Common;
using StudyPlatform.Application.Services;
using StudyPlatform.Application.Videos;
using StudyPlatform.Domain.Entities;

namespace StudyPlatform.API.Controllers;

// Shared access check and video-URL helpers. Transcript retrieval lives in IVideoTranscriptProvider.
public partial class VideoController
{
    // ── Access helper ─────────────────────────────────────────────────────

    private async Task<Video?> GetVideoWithAccessCheckAsync(Guid id, Guid userId, CancellationToken cancellationToken)
    {
        var video = await _unitOfWork.Videos.GetByIdForUserAsync(id, userId, cancellationToken);
        if (video is not null) return video;

        video = await _unitOfWork.Videos.GetByIdWithCourseAsync(id, cancellationToken);
        if (video is null) return null;

        return await _unitOfWork.HasSharedCourseAccessAsync(userId, video.CourseId, cancellationToken) ? video : null;
    }

    // ── URL helpers ───────────────────────────────────────────────────────

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
