using MediatR;
using Microsoft.Extensions.Options;
using StudyPlatform.Application.Common;
using StudyPlatform.Application.Services;
using StudyPlatform.Application.Settings;
using StudyPlatform.Application.Videos.DTOs;
using StudyPlatform.Domain.Entities;
using StudyPlatform.Domain.Interfaces;

namespace StudyPlatform.Application.Videos.Commands;

/// <summary>A file the client sent, without the web framework's type: the API layer opens the stream.</summary>
public sealed record UploadedFile(Stream Content, string FileName, string ContentType, long Length);

/// <summary>
/// Stores an uploaded video (and optional cover) in a course and records it, pending background
/// transcription — which the caller queues, since the queue lives in the API process.
/// </summary>
public record UploadVideoCommand(Guid UserId, Guid CourseId, UploadedFile File, UploadedFile? Thumbnail)
    : IRequest<Result<VideoDto>>;

public class UploadVideoCommandHandler : IRequestHandler<UploadVideoCommand, Result<VideoDto>>
{
    private static readonly HashSet<string> AllowedExtensions = new(StringComparer.OrdinalIgnoreCase)
    {
        ".mp4", ".mov", ".m4v", ".webm", ".mkv", ".avi",
        ".wmv", ".flv", ".3gp", ".3g2", ".ts", ".mts", ".m2ts", ".mpg", ".mpeg", ".ogv",
        ".vob", ".asf",
    };

    private readonly ICourseRepository _courses;
    private readonly IVideoRepository _videos;
    private readonly IBlobStorageService _blobStorage;
    private readonly IStoredFileCleanup _storedFiles;
    private readonly AppLimitsOptions _limits;

    public UploadVideoCommandHandler(ICourseRepository courses, IVideoRepository videos, IBlobStorageService blobStorage, IStoredFileCleanup storedFiles, IOptions<AppLimitsOptions> limits)
    {
        _courses = courses;
        _videos = videos;
        _blobStorage = blobStorage;
        _storedFiles = storedFiles;
        _limits = limits.Value;
    }

    public async Task<Result<VideoDto>> Handle(UploadVideoCommand request, CancellationToken cancellationToken)
    {
        var file = request.File;
        if (file.Length == 0)
            return Result<VideoDto>.Failure("No file provided.", "NO_FILE");

        if (!file.ContentType.StartsWith("video/", StringComparison.OrdinalIgnoreCase)
            && !AllowedExtensions.Contains(Path.GetExtension(file.FileName)))
            return Result<VideoDto>.Failure(
                "File type not supported. Allowed: MP4, MOV, WEBM, MKV, AVI, WMV, FLV, 3GP, TS, MPG, OGV, VOB, ASF.", "INVALID_FILE_TYPE");

        if (await _courses.GetOwnedAsync(request.CourseId, request.UserId, cancellationToken) == null)
            return Result<VideoDto>.Failure("Course not found.", "COURSE_NOT_FOUND");

        // Cheap early answer for the common case; the authoritative check is the atomic insert below.
        if (_limits.VideoUploadLimit >= 0 && await CountUploadsAsync(request.UserId, cancellationToken) >= _limits.VideoUploadLimit)
            return LimitReached();

        // Streamed straight to storage. The client's file name is display-only; the key uses a sanitised copy.
        var prefix = $"{request.UserId}/{request.CourseId}/videos";
        var blobUrl = await _blobStorage.UploadAsync(
            file.Content, $"{prefix}/{Guid.NewGuid()}_{SafeBlobFileName(file.FileName)}", file.ContentType, cancellationToken);

        var thumbnailUrl = string.Empty;
        if (request.Thumbnail is { Length: > 0 } thumbnail && thumbnail.ContentType.StartsWith("image/", StringComparison.OrdinalIgnoreCase))
        {
            var ext = Path.GetExtension(thumbnail.FileName).ToLowerInvariant();
            if (ext is not (".png" or ".jpg" or ".jpeg" or ".webp"))
                ext = ".jpg";
            thumbnailUrl = await _blobStorage.UploadAsync(
                thumbnail.Content, $"{prefix}/covers/{Guid.NewGuid()}{ext}", thumbnail.ContentType, cancellationToken);
        }

        var video = new Video
        {
            VideoId = Guid.NewGuid(),
            UserId = request.UserId,
            CourseId = request.CourseId,
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

        // Count and insert under one per-user lock: checked separately, parallel uploads all passed the
        // count and together went over the limit.
        if (!await _videos.AddUploadWithinLimitAsync(video, _limits.VideoUploadLimit, cancellationToken))
        {
            await _storedFiles.DeleteAsync([blobUrl, thumbnailUrl], CancellationToken.None);
            return LimitReached();
        }

        var saved = await _videos.GetByIdForUserAsync(video.VideoId, request.UserId, cancellationToken);
        return Result<VideoDto>.Success(SaveVideoCommandHandler.ToDto(saved!));
    }

    private Task<int> CountUploadsAsync(Guid userId, CancellationToken cancellationToken)
        => _videos.CountAsync(v => v.UserId == userId && v.SourceType == "upload", cancellationToken);

    private Result<VideoDto> LimitReached() => Result<VideoDto>.Failure(
        $"Upload limit of {_limits.VideoUploadLimit} videos per account reached.", "VIDEO_LIMIT_REACHED");

    internal static string SafeBlobFileName(string fileName)
    {
        var name = Path.GetFileName(fileName);
        var safe = new string(name.Select(c => char.IsAsciiLetterOrDigit(c) || c is '.' or '-' or '_' ? c : '_').ToArray());
        return string.IsNullOrEmpty(safe.Trim('.', '_')) ? "video" : safe[..Math.Min(safe.Length, 100)];
    }
}
