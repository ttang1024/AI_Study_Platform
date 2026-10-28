using Microsoft.Extensions.Options;
using StudyPlatform.Application.Common;
using StudyPlatform.Application.Services;
using StudyPlatform.Application.Settings;
using StudyPlatform.Application.Videos.Transcripts;
using StudyPlatform.Domain.Interfaces;

namespace StudyPlatform.Application.Videos.Generation;

/// <summary>What the AI can generate from a video's transcript.</summary>
public enum VideoAiArtifact
{
    MindMap,
    Quiz,
    Flashcards,
    Summary,
}

/// <summary>
/// AI generation over video transcripts — the one pipeline behind both the "paste a URL" endpoints and
/// the saved-video mind map and summary. Each endpoint used to repeat validate → cache → transcript →
/// generate → cache by hand, once for the streaming variant and once again for the plain one.
/// </summary>
public interface IVideoAiGenerator
{
    /// <summary>Generates <paramref name="artifact"/> for a pasted video URL, as complete text.</summary>
    Task<Result<string>> GenerateForUrlAsync(string? videoUrl, VideoAiArtifact artifact, CancellationToken cancellationToken);

    /// <summary>Generates <paramref name="artifact"/> for a pasted video URL, as a stream.</summary>
    Task<Result<AiTextStream>> StreamForUrlAsync(string? videoUrl, VideoAiArtifact artifact, CancellationToken cancellationToken);

    /// <summary>
    /// Streams a saved video's mind map or summary. The finished text is stored on the video — only when
    /// <paramref name="userId"/> owns it: a member of a shared course gets the result but can't overwrite
    /// the owner's copy.
    /// </summary>
    Task<Result<AiTextStream>> StreamForSavedVideoAsync(Guid videoId, Guid userId, VideoAiArtifact artifact, CancellationToken cancellationToken);
}

/// <inheritdoc cref="IVideoAiGenerator"/>
public sealed class VideoAiGenerator : IVideoAiGenerator
{
    private const string NoTranscriptMessage = "No subtitles available for this video.";

    private readonly IAiService _aiService;
    private readonly IAiCredentialsProvider _credentials;
    private readonly IVideoTranscriptProvider _transcripts;
    private readonly IAppCache _cache;
    private readonly IVideoRepository _videos;
    private readonly IVideoAccess _videoAccess;
    private readonly TimeSpan _ttl;

    public VideoAiGenerator(
        IAiService aiService,
        IAiCredentialsProvider credentials,
        IVideoTranscriptProvider transcripts,
        IAppCache cache,
        IVideoRepository videos,
        IVideoAccess videoAccess,
        IOptions<CacheOptions> cacheOptions)
    {
        _aiService = aiService;
        _credentials = credentials;
        _transcripts = transcripts;
        _cache = cache;
        _videos = videos;
        _videoAccess = videoAccess;
        _ttl = TimeSpan.FromSeconds(cacheOptions.Value.GeneratedResultSeconds);
    }

    public async Task<Result<string>> GenerateForUrlAsync(string? videoUrl, VideoAiArtifact artifact, CancellationToken cancellationToken)
    {
        var prepared = await PrepareUrlAsync(videoUrl, artifact, cancellationToken);
        if (!prepared.IsSuccess)
            return Result<string>.Failure(prepared.Message, prepared.ErrorCode);

        var (cacheKey, cached, transcript) = prepared.Data!;
        if (cached is not null)
            return Result<string>.Success(cached);

        var text = await GenerateAsync(transcript!, artifact, cancellationToken);
        await _cache.SetAsync(cacheKey, text, _ttl, cancellationToken);
        return Result<string>.Success(text);
    }

    public async Task<Result<AiTextStream>> StreamForUrlAsync(string? videoUrl, VideoAiArtifact artifact, CancellationToken cancellationToken)
    {
        var prepared = await PrepareUrlAsync(videoUrl, artifact, cancellationToken);
        if (!prepared.IsSuccess)
            return Result<AiTextStream>.Failure(prepared.Message, prepared.ErrorCode);

        var (cacheKey, cached, transcript) = prepared.Data!;
        if (cached is not null)
            return Result<AiTextStream>.Success(AiTextStream.FromCache(cached));

        return Result<AiTextStream>.Success(new AiTextStream(
            null,
            Stream(transcript!, artifact, cancellationToken),
            (text, ct) => _cache.SetAsync(cacheKey, text, _ttl, ct)));
    }

    public async Task<Result<AiTextStream>> StreamForSavedVideoAsync(
        Guid videoId, Guid userId, VideoAiArtifact artifact, CancellationToken cancellationToken)
    {
        if (artifact is not (VideoAiArtifact.MindMap or VideoAiArtifact.Summary))
            throw new ArgumentOutOfRangeException(nameof(artifact), artifact, "Only mind maps and summaries are stored on a saved video.");

        var video = await _videoAccess.GetAccessibleVideoAsync(videoId, userId, cancellationToken);
        if (video is null)
            return Result<AiTextStream>.Failure("Video not found.", "VIDEO_NOT_FOUND");

        var transcript = artifact == VideoAiArtifact.Summary
            ? await _transcripts.GetOrFetchTimelineTranscriptAsync(video, cancellationToken)
            : await _transcripts.GetOrFetchTranscriptAsync(video, cancellationToken);
        if (transcript is null)
            return Result<AiTextStream>.Failure(NoTranscriptMessage, "NO_TRANSCRIPT");

        Func<string, CancellationToken, Task>? store = video.UserId != userId ? null
            : artifact == VideoAiArtifact.Summary
                ? (text, ct) => _videos.SaveSummaryAsync(video.VideoId, text, ct)
                : (text, ct) => _videos.SaveMindMapAsync(video.VideoId, text, ct);

        return Result<AiTextStream>.Success(new AiTextStream(null, Stream(transcript, artifact, cancellationToken), store));
    }

    private async Task<Result<(string CacheKey, string? Cached, string? Transcript)>> PrepareUrlAsync(
        string? videoUrl, VideoAiArtifact artifact, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(videoUrl))
            return Result<(string, string?, string?)>.Failure("videoUrl is required.", "MISSING_VIDEO_URL");

        var videoKey = VideoUrls.ExtractVideoId(videoUrl);
        if (videoKey is null)
            return Result<(string, string?, string?)>.Failure("Invalid YouTube URL.", "INVALID_VIDEO_URL");

        // Credentials first: a cached result is the caller's own, so it is only served to a caller who
        // could have generated it.
        var cacheKey = VideoCacheKeys.Generated(artifact.ToString(), videoKey, _credentials.GetRequired().CacheScope);
        var cached = await _cache.GetAsync<string>(cacheKey, cancellationToken);
        if (!string.IsNullOrEmpty(cached))
            return Result<(string, string?, string?)>.Success((cacheKey, cached, null));

        var transcript = artifact == VideoAiArtifact.Summary
            ? await _transcripts.GetTranscriptTimelineTextAsync(videoKey, cancellationToken)
            : await _transcripts.GetTranscriptTextAsync(videoKey, cancellationToken);
        if (transcript is null)
            return Result<(string, string?, string?)>.Failure(NoTranscriptMessage, "NO_TRANSCRIPT");

        return Result<(string, string?, string?)>.Success((cacheKey, null, transcript));
    }

    private async Task<string> GenerateAsync(string transcript, VideoAiArtifact artifact, CancellationToken cancellationToken)
        => artifact switch
        {
            VideoAiArtifact.MindMap => await _aiService.GenerateMindMapFromYouTubeAsync(transcript, cancellationToken),
            VideoAiArtifact.Quiz => await _aiService.GenerateQuizFromYouTubeAsync(transcript, "medium", cancellationToken),
            VideoAiArtifact.Flashcards => await _aiService.GenerateFlashcardsFromYouTubeAsync(transcript, cancellationToken),
            VideoAiArtifact.Summary => await Collect(_aiService.StreamTimelineSummaryAsync(transcript, cancellationToken)),
            _ => throw new ArgumentOutOfRangeException(nameof(artifact), artifact, null),
        };

    private IAsyncEnumerable<string> Stream(string transcript, VideoAiArtifact artifact, CancellationToken cancellationToken)
        => artifact switch
        {
            VideoAiArtifact.MindMap => _aiService.StreamMindMapFromYouTubeAsync(transcript, cancellationToken),
            VideoAiArtifact.Summary => _aiService.StreamTimelineSummaryAsync(transcript, cancellationToken),
            // No streaming variant: the whole JSON arrives as one chunk.
            _ => Once(() => GenerateAsync(transcript, artifact, cancellationToken)),
        };

    private static async IAsyncEnumerable<string> Once(Func<Task<string>> produce)
    {
        yield return await produce();
    }

    private static async Task<string> Collect(IAsyncEnumerable<string> stream)
    {
        var builder = new System.Text.StringBuilder();
        await foreach (var chunk in stream)
            builder.Append(chunk);
        return builder.ToString();
    }
}
