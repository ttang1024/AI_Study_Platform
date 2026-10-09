using Microsoft.Extensions.Options;
using StudyPlatform.Application.Services;
using StudyPlatform.Application.Settings;
using StudyPlatform.Domain.Entities;
using StudyPlatform.Domain.Interfaces;

namespace StudyPlatform.Application.Videos.Transcripts;

/// <summary>
/// Gets a video's transcript text or timeline the cheapest way available: app cache → the saved video
/// row → stored segments → fetching from the source (author subtitles first, then the auto transcript),
/// writing back to each tier on a miss.
/// </summary>
public interface IVideoTranscriptProvider
{
    /// <summary>Plain transcript for a saved video; null when the source has none.</summary>
    Task<string?> GetOrFetchTranscriptAsync(Video video, CancellationToken cancellationToken);

    /// <summary>Timestamped transcript for a saved video, falling back to plain text.</summary>
    Task<string?> GetOrFetchTimelineTranscriptAsync(Video video, CancellationToken cancellationToken);

    /// <summary>Plain transcript by external video id, for callers without a saved video.</summary>
    Task<string?> GetTranscriptTextAsync(string videoId, CancellationToken cancellationToken);

    /// <summary>Timestamped transcript by external video id.</summary>
    Task<string?> GetTranscriptTimelineTextAsync(string videoId, CancellationToken cancellationToken);

    /// <summary>
    /// Character offsets at which each timed segment starts in the joined transcript text, for turning a
    /// cited quote into a timestamp. Null when only an untimed transcript exists.
    /// </summary>
    Task<List<(double StartSeconds, int TextOffset)>?> GetSegmentOffsetsAsync(Video video, CancellationToken cancellationToken);

    /// <summary>Stored segments of one kind; transcript-kind segments come back prepared for reading.</summary>
    Task<List<TranscriptSegmentDto>?> GetStoredSegmentsAsync(string videoKey, string kind, CancellationToken cancellationToken);

    /// <summary>Stores segments; transcript-kind segments are prepared for reading first.</summary>
    Task StoreSegmentsAsync(string videoKey, string kind, IReadOnlyCollection<TranscriptSegmentDto> segments, TimeSpan ttl, CancellationToken cancellationToken);

    /// <summary>The store/cache key for a saved video's transcript.</summary>
    static string KeyFor(Video video) => $"{VideoSourceTypes.Normalize(video.SourceType)}:{video.ExternalVideoId}";
}

public sealed class VideoTranscriptProvider : IVideoTranscriptProvider
{
    private readonly IAppCache _cache;
    private readonly IUnitOfWork _unitOfWork;
    private readonly IYouTubeTranscriptService _transcriptService;
    private readonly ITranscriptSegmentStore _store;
    private readonly TimeSpan _ttl;

    public VideoTranscriptProvider(
        IAppCache cache,
        IUnitOfWork unitOfWork,
        IYouTubeTranscriptService transcriptService,
        ITranscriptSegmentStore store,
        IOptions<CacheOptions> cacheOptions)
    {
        _cache = cache;
        _unitOfWork = unitOfWork;
        _transcriptService = transcriptService;
        _store = store;
        _ttl = TimeSpan.FromSeconds(cacheOptions.Value.TranscriptSeconds);
    }

    public async Task<List<TranscriptSegmentDto>?> GetStoredSegmentsAsync(string videoKey, string kind, CancellationToken cancellationToken)
    {
        var segments = await _store.GetAsync(videoKey, kind, cancellationToken);
        return kind == TranscriptKinds.Transcript && segments is not null
            ? TranscriptSegmentation.Prepare(segments)
            : segments;
    }

    public Task StoreSegmentsAsync(string videoKey, string kind, IReadOnlyCollection<TranscriptSegmentDto> segments, TimeSpan ttl, CancellationToken cancellationToken)
    {
        if (segments.Count == 0)
            return Task.CompletedTask;
        if (kind == TranscriptKinds.Transcript)
            segments = TranscriptSegmentation.Prepare(segments);
        return _store.UpsertAsync(videoKey, kind, segments, ttl, cancellationToken);
    }

    /// <summary>Stored segments of the first of <paramref name="kinds"/> that has any.</summary>
    private async Task<List<TranscriptSegmentDto>?> GetFirstStoredAsync(string videoKey, CancellationToken cancellationToken, params string[] kinds)
    {
        foreach (var kind in kinds)
        {
            var segments = await GetStoredSegmentsAsync(videoKey, kind, cancellationToken);
            if (segments is { Count: > 0 })
                return segments;
        }
        return null;
    }

    public async Task<List<(double StartSeconds, int TextOffset)>?> GetSegmentOffsetsAsync(Video video, CancellationToken cancellationToken)
    {
        var segments = await GetFirstStoredAsync(IVideoTranscriptProvider.KeyFor(video), cancellationToken,
            TranscriptKinds.Subtitles, TranscriptKinds.Transcript);
        if (segments is not { Count: > 0 })
            return null;

        // Must reproduce the exact string.Join(" ", …) GetOrFetchTranscriptAsync builds, so the offsets
        // line up with the text the model saw.
        var offsets = new List<(double, int)>(segments.Count);
        var cursor = 0;
        foreach (var segment in segments)
        {
            offsets.Add((segment.StartSeconds, cursor));
            cursor += segment.Text.Length + 1;
        }
        return offsets;
    }

    public async Task<string?> GetOrFetchTranscriptAsync(Video video, CancellationToken cancellationToken)
    {
        var transcriptKey = IVideoTranscriptProvider.KeyFor(video);
        var cacheKey = VideoCacheKeys.Transcript(transcriptKey);

        var cached = await _cache.GetAsync<string>(cacheKey, cancellationToken);
        if (!string.IsNullOrEmpty(cached))
            return cached;

        if (!string.IsNullOrEmpty(video.Transcript))
        {
            await _cache.SetAsync(cacheKey, video.Transcript, _ttl, cancellationToken);
            return video.Transcript;
        }

        var storedSegments = await GetFirstStoredAsync(transcriptKey, cancellationToken, TranscriptKinds.Subtitles, TranscriptKinds.Transcript);
        if (storedSegments is { Count: > 0 })
        {
            var storedTranscript = string.Join(" ", storedSegments.Select(s => s.Text));
            await SaveTranscriptOnVideoAsync(video, storedTranscript, cancellationToken);
            await _cache.SetAsync(cacheKey, storedTranscript, _ttl, cancellationToken);
            return storedTranscript;
        }

        var (dtos, transcriptKind) = await FetchSegmentsAsync(video, cancellationToken);
        if (dtos is null) return null;

        var transcript = string.Join(" ", dtos.Select(s => s.Text));
        await SaveTranscriptOnVideoAsync(video, transcript, cancellationToken);
        await StoreSegmentsAsync(transcriptKey, transcriptKind, dtos, _ttl, cancellationToken);
        await _cache.SetAsync(cacheKey, transcript, _ttl, cancellationToken);
        return transcript;
    }

    public async Task<string?> GetOrFetchTimelineTranscriptAsync(Video video, CancellationToken cancellationToken)
    {
        var transcriptKey = IVideoTranscriptProvider.KeyFor(video);
        var segmentsCacheKey = VideoCacheKeys.TranscriptSegments(transcriptKey);

        var cached = await _cache.GetAsync<List<TranscriptSegmentDto>>(segmentsCacheKey, cancellationToken);
        if (cached is { Count: > 0 })
            return TranscriptSegmentation.Format(cached);

        var storedSegments = await GetFirstStoredAsync(transcriptKey, cancellationToken, TranscriptKinds.Subtitles, TranscriptKinds.Transcript);
        if (storedSegments is { Count: > 0 })
        {
            await _cache.SetAsync(segmentsCacheKey, storedSegments, _ttl, cancellationToken);
            return TranscriptSegmentation.Format(storedSegments);
        }

        var (dtos, transcriptKind) = await FetchSegmentsAsync(video, cancellationToken);
        if (dtos is null)
            return await GetOrFetchTranscriptAsync(video, cancellationToken);

        await StoreSegmentsAsync(transcriptKey, transcriptKind, dtos, _ttl, cancellationToken);
        await _cache.SetAsync(segmentsCacheKey, dtos, _ttl, cancellationToken);
        return TranscriptSegmentation.Format(dtos);
    }

    public async Task<string?> GetTranscriptTextAsync(string videoId, CancellationToken cancellationToken)
    {
        var cacheKey = VideoCacheKeys.Transcript(videoId);

        var cached = await _cache.GetAsync<string>(cacheKey, cancellationToken);
        if (!string.IsNullOrEmpty(cached))
            return cached;

        var savedVideo = await _unitOfWork.Videos.GetByExternalVideoIdAsync(videoId, cancellationToken);
        if (savedVideo != null)
            return await GetOrFetchTranscriptAsync(savedVideo, cancellationToken);

        var storedSegments = await GetFirstStoredAsync(videoId, cancellationToken, TranscriptKinds.Subtitles, TranscriptKinds.Transcript);
        if (storedSegments is { Count: > 0 })
        {
            var storedTranscript = string.Join(" ", storedSegments.Select(s => s.Text));
            await _cache.SetAsync(cacheKey, storedTranscript, _ttl, cancellationToken);
            return storedTranscript;
        }

        var (dtos, transcriptKind) = await FetchSegmentsAsync(videoId, cancellationToken);
        if (dtos is null) return null;

        var transcript = string.Join(" ", dtos.Select(s => s.Text));
        await StoreSegmentsAsync(videoId, transcriptKind, dtos, _ttl, cancellationToken);
        await _cache.SetAsync(cacheKey, transcript, _ttl, cancellationToken);
        return transcript;
    }

    public async Task<string?> GetTranscriptTimelineTextAsync(string videoId, CancellationToken cancellationToken)
    {
        var cacheKey = VideoCacheKeys.TranscriptSegments(videoId);

        var cached = await _cache.GetAsync<List<TranscriptSegmentDto>>(cacheKey, cancellationToken);
        if (cached is { Count: > 0 })
            return TranscriptSegmentation.Format(cached);

        var storedSegments = await GetFirstStoredAsync(videoId, cancellationToken, TranscriptKinds.Transcript, TranscriptKinds.Subtitles);
        if (storedSegments is { Count: > 0 })
        {
            await _cache.SetAsync(cacheKey, storedSegments, _ttl, cancellationToken);
            return TranscriptSegmentation.Format(storedSegments);
        }

        var (dtos, transcriptKind) = await FetchSegmentsAsync(videoId, cancellationToken);
        if (dtos is not null)
        {
            await StoreSegmentsAsync(videoId, transcriptKind, dtos, _ttl, cancellationToken);
            await _cache.SetAsync(cacheKey, dtos, _ttl, cancellationToken);
            return TranscriptSegmentation.Format(dtos);
        }

        return await GetTranscriptTextAsync(videoId, cancellationToken);
    }

    private async Task SaveTranscriptOnVideoAsync(Video video, string transcript, CancellationToken cancellationToken)
    {
        video.Transcript = transcript;
        video.UpdatedAt = DateTime.UtcNow;
        _unitOfWork.Videos.Update(video);
        await _unitOfWork.SaveChangesAsync(cancellationToken);
    }

    // Sources whose transcript must be fetched by full URL (yt-dlp) rather than YouTube video id.
    private static bool IsExternalVideoSource(Video video)
        => VideoSourceTypes.Normalize(video.SourceType)
            is "bilibili" or "vimeo" or "ted" or "dailymotion"
            or "facebook" or "instagram" or "twitter" or "reddit" or "linkedin" or "tiktok";

    // Subtitles (author captions) are preferred; the auto-generated transcript is the fallback.
    private Task<(List<TranscriptSegmentDto>? Segments, string Kind)> FetchSegmentsAsync(Video video, CancellationToken cancellationToken)
        // An upload has no remote source: its transcript only ever comes from our own Whisper job
        // (TranscribeUploadedVideoCommand). Asking YouTube for "upload-…" ids just burned a request.
        => VideoSourceTypes.Normalize(video.SourceType) == "upload"
            ? Task.FromResult<(List<TranscriptSegmentDto>?, string)>((null, TranscriptKinds.Transcript))
            : IsExternalVideoSource(video)
            ? FetchSegmentsAsync(
                () => _transcriptService.GetSubtitlesFromUrlAsync(video.VideoUrl, cancellationToken),
                () => _transcriptService.GetTranscriptFromUrlAsync(video.VideoUrl, cancellationToken))
            : FetchSegmentsAsync(video.ExternalVideoId, cancellationToken);

    private Task<(List<TranscriptSegmentDto>? Segments, string Kind)> FetchSegmentsAsync(string videoId, CancellationToken cancellationToken)
        => FetchSegmentsAsync(
            () => _transcriptService.GetSubtitlesAsync(videoId, cancellationToken),
            () => _transcriptService.GetTranscriptAsync(videoId, cancellationToken));

    private static async Task<(List<TranscriptSegmentDto>? Segments, string Kind)> FetchSegmentsAsync(
        Func<Task<IReadOnlyList<TranscriptSegment>?>> fetchSubtitles,
        Func<Task<IReadOnlyList<TranscriptSegment>?>> fetchTranscript)
    {
        var segments = await fetchSubtitles();
        var kind = TranscriptKinds.Subtitles;
        if (segments is not { Count: > 0 })
        {
            segments = await fetchTranscript();
            kind = TranscriptKinds.Transcript;
        }
        if (segments is not { Count: > 0 })
            return (null, kind);

        return (segments.Select(s => new TranscriptSegmentDto(s.Start.TotalSeconds, s.Text)).ToList(), kind);
    }
}
