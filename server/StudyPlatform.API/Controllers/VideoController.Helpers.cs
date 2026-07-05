using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
using System.Security.Cryptography;
using Microsoft.EntityFrameworkCore;
using StudyPlatform.API.Extensions;
using StudyPlatform.Domain.Entities;

namespace StudyPlatform.API.Controllers;

// Shared access check, transcript fetch/store, segmentation & formatting helpers.
public partial class VideoController
{
    // ── Access helper ─────────────────────────────────────────────────────

    private async Task<YouTubeVideo?> GetVideoWithAccessCheckAsync(Guid id, Guid userId, CancellationToken cancellationToken)
    {
        var video = await _unitOfWork.YouTubeVideos.GetByIdForUserAsync(id, userId, cancellationToken);
        if (video is not null) return video;

        video = await _unitOfWork.YouTubeVideos.GetByIdWithCourseAsync(id, cancellationToken);
        if (video is null) return null;

        var shared = await _unitOfWork.StudyGroupSharedCourses.FindAsync(sc => sc.CourseId == video.CourseId, cancellationToken);
        var groupIds = shared.Select(sc => sc.GroupId).ToList();
        var hasGroupAccess = groupIds.Count > 0 && await _unitOfWork.StudyGroupMembers.ExistsAsync(
            m => groupIds.Contains(m.GroupId) && m.UserId == userId, cancellationToken);
        return hasGroupAccess ? video : null;
    }

    // ── Transcript helper ─────────────────────────────────────────────────

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

    private static string NormalizeSourceType(string? sourceType) => sourceType?.Trim().ToLowerInvariant() switch
    {
        "bilibili" => "bilibili",
        "upload" => "upload",
        "vimeo" => "vimeo",
        "ted" => "ted",
        "dailymotion" => "dailymotion",
        "facebook" => "facebook",
        "instagram" => "instagram",
        "twitter" => "twitter",
        "reddit" => "reddit",
        "linkedin" => "linkedin",
        "tiktok" => "tiktok",
        _ => "youtube"
    };

    // Sources whose transcript must be fetched by full URL (yt-dlp) rather than YouTube video id.
    private static bool IsExternalVideoSource(YouTubeVideo video)
        => NormalizeSourceType(video.SourceType)
            is "bilibili" or "vimeo" or "ted" or "dailymotion"
            or "facebook" or "instagram" or "twitter" or "reddit" or "linkedin" or "tiktok";

    private static bool IsBilibiliVideo(YouTubeVideo video)
        => string.Equals(video.SourceType, "bilibili", StringComparison.OrdinalIgnoreCase);

    private static string TranscriptCacheKey(string videoId) => $"transcript:{videoId}";
    private static string TranscriptSegmentsCacheKey(string videoId) => $"transcript_segments:{videoId}";
    private static string SubtitlesCacheKey(string videoId) => $"subtitles:{videoId}";
    private static string MindMapCacheKey(string videoId) => $"mindmap:{videoId}";
    private static string SummaryCacheKey(string videoId) => $"summary:{videoId}";
    private static string QuizCacheKey(string videoId) => $"quiz:{videoId}";
    private static string FlashcardsCacheKey(string videoId) => $"flashcards:{videoId}";
    private static string VideoGlossaryCacheKey(Guid videoRecordId, Guid userId) => $"glossary:video:{videoRecordId}:{userId}";
    private static string VideoQuizCacheKey(Guid videoRecordId, Guid userId, string difficulty) => $"quiz:video:{videoRecordId}:{userId}:{difficulty}";

    private async Task<List<TranscriptSegmentDto>?> GetStoredTranscriptSegmentsAsync(
        string videoId,
        string kind,
        CancellationToken cancellationToken)
    {
        var entryVideoId = TranscriptEntryVideoId(videoId);
        var entry = await _db.YouTubeTranscriptEntries.FindAsync([entryVideoId, kind], cancellationToken);
        if (entry is null)
            return null;

        if (entry.ExpiresAt <= DateTime.UtcNow)
        {
            _db.YouTubeTranscriptEntries.Remove(entry);
            await _db.SaveChangesAsync(cancellationToken);
            return null;
        }

        try
        {
            var segments = JsonSerializer.Deserialize<List<TranscriptSegmentDto>>(entry.SegmentsJson,
                new JsonSerializerOptions { PropertyNameCaseInsensitive = true });
            return kind == TranscriptKind && segments is not null
                ? PrepareTranscriptSegments(segments)
                : segments;
        }
        catch
        {
            _db.YouTubeTranscriptEntries.Remove(entry);
            await _db.SaveChangesAsync(cancellationToken);
            return null;
        }
    }

    private async Task StoreTranscriptSegmentsAsync(
        string videoId,
        string kind,
        IReadOnlyCollection<TranscriptSegmentDto> segments,
        TimeSpan ttl,
        CancellationToken cancellationToken)
    {
        if (segments.Count == 0)
            return;

        if (kind == TranscriptKind)
            segments = PrepareTranscriptSegments(segments);

        var now = DateTime.UtcNow;
        var expiresAt = now.Add(ttl);
        var segmentsJson = JsonSerializer.Serialize(segments);
        var entryVideoId = TranscriptEntryVideoId(videoId);

        await _db.Database.ExecuteSqlInterpolatedAsync($"""
            INSERT INTO "YouTubeTranscriptEntries" ("VideoId", "Kind", "SegmentsJson", "ExpiresAt", "CreatedAt", "UpdatedAt")
            VALUES ({entryVideoId}, {kind}, {segmentsJson}, {expiresAt}, {now}, {now})
            ON CONFLICT ("VideoId", "Kind") DO UPDATE
            SET "SegmentsJson" = EXCLUDED."SegmentsJson",
                "ExpiresAt" = EXCLUDED."ExpiresAt",
                "UpdatedAt" = EXCLUDED."UpdatedAt";
            """, cancellationToken);
    }

    private static string TranscriptEntryVideoId(string videoId)
    {
        if (videoId.Length <= 32)
            return videoId;

        var hash = SHA256.HashData(Encoding.UTF8.GetBytes(videoId));
        return Convert.ToHexString(hash).ToLowerInvariant()[..32];
    }

    // Returns transcript from Redis → DB → YouTube fetch (in that order), persisting to DB and Redis on miss.
    private async Task<string?> GetOrFetchTranscriptAsync(YouTubeVideo video, CancellationToken cancellationToken)
    {
        var transcriptKey = $"{NormalizeSourceType(video.SourceType)}:{video.VideoId}";
        var cacheKey = TranscriptCacheKey(transcriptKey);
        var ttl = TimeSpan.FromSeconds(_cacheOptions.TranscriptSeconds);

        var cached = await _cache.GetAsync<string>(cacheKey, cancellationToken);
        if (!string.IsNullOrEmpty(cached))
            return cached;

        if (!string.IsNullOrEmpty(video.Transcript))
        {
            await _cache.SetAsync(cacheKey, video.Transcript, ttl, cancellationToken);
            return video.Transcript;
        }

        var storedSegments = await GetStoredTranscriptSegmentsAsync(transcriptKey, SubtitlesKind, cancellationToken)
                             ?? await GetStoredTranscriptSegmentsAsync(transcriptKey, TranscriptKind, cancellationToken);
        if (storedSegments is { Count: > 0 })
        {
            var storedTranscript = string.Join(" ", storedSegments.Select(s => s.Text));
            video.Transcript = storedTranscript;
            video.UpdatedAt = DateTime.UtcNow;
            _unitOfWork.YouTubeVideos.Update(video);
            await _unitOfWork.SaveChangesAsync(cancellationToken);
            await _cache.SetAsync(cacheKey, storedTranscript, ttl, cancellationToken);
            return storedTranscript;
        }

        var segments = IsExternalVideoSource(video)
            ? await _transcriptService.GetSubtitlesFromUrlAsync(video.VideoUrl, cancellationToken)
            : await _transcriptService.GetSubtitlesAsync(video.VideoId, cancellationToken);
        var transcriptKind = SubtitlesKind;
        if (segments == null || segments.Count == 0)
        {
            segments = IsExternalVideoSource(video)
                ? await _transcriptService.GetTranscriptFromUrlAsync(video.VideoUrl, cancellationToken)
                : await _transcriptService.GetTranscriptAsync(video.VideoId, cancellationToken);
            transcriptKind = TranscriptKind;
        }
        if (segments == null || segments.Count == 0) return null;

        var dtos = segments.Select(s => new TranscriptSegmentDto(s.Start.TotalSeconds, s.Text)).ToList();
        var transcript = string.Join(" ", segments.Select(s => s.Text));
        video.Transcript = transcript;
        video.UpdatedAt = DateTime.UtcNow;
        _unitOfWork.YouTubeVideos.Update(video);
        await _unitOfWork.SaveChangesAsync(cancellationToken);
        await StoreTranscriptSegmentsAsync(transcriptKey, transcriptKind, dtos, ttl, cancellationToken);
        await _cache.SetAsync(cacheKey, transcript, ttl, cancellationToken);
        return transcript;
    }

    // Returns a timestamped transcript for a saved video (used by timeline-aware summary).
    private async Task<string?> GetOrFetchTimelineTranscriptAsync(YouTubeVideo video, CancellationToken cancellationToken)
    {
        var transcriptKey = $"{NormalizeSourceType(video.SourceType)}:{video.VideoId}";
        var segmentsCacheKey = TranscriptSegmentsCacheKey(transcriptKey);
        var ttl = TimeSpan.FromSeconds(_cacheOptions.TranscriptSeconds);

        var cached = await _cache.GetAsync<List<TranscriptSegmentDto>>(segmentsCacheKey, cancellationToken);
        if (cached is { Count: > 0 })
            return FormatTranscriptSegments(cached);

        var storedSegments = await GetStoredTranscriptSegmentsAsync(transcriptKey, SubtitlesKind, cancellationToken)
                             ?? await GetStoredTranscriptSegmentsAsync(transcriptKey, TranscriptKind, cancellationToken);
        if (storedSegments is { Count: > 0 })
        {
            await _cache.SetAsync(segmentsCacheKey, storedSegments, ttl, cancellationToken);
            return FormatTranscriptSegments(storedSegments);
        }

        var segments = IsExternalVideoSource(video)
            ? await _transcriptService.GetSubtitlesFromUrlAsync(video.VideoUrl, cancellationToken)
            : await _transcriptService.GetSubtitlesAsync(video.VideoId, cancellationToken);
        var transcriptKind = SubtitlesKind;
        if (segments == null || segments.Count == 0)
        {
            segments = IsExternalVideoSource(video)
                ? await _transcriptService.GetTranscriptFromUrlAsync(video.VideoUrl, cancellationToken)
                : await _transcriptService.GetTranscriptAsync(video.VideoId, cancellationToken);
            transcriptKind = TranscriptKind;
        }
        if (segments == null || segments.Count == 0)
            return await GetOrFetchTranscriptAsync(video, cancellationToken);

        var dtos = segments.Select(s => new TranscriptSegmentDto(s.Start.TotalSeconds, s.Text)).ToList();
        await StoreTranscriptSegmentsAsync(transcriptKey, transcriptKind, dtos, ttl, cancellationToken);
        await _cache.SetAsync(segmentsCacheKey, dtos, ttl, cancellationToken);
        return FormatTranscriptSegments(dtos);
    }

    // For anonymous endpoints: Redis → DB → YouTube fetch without requiring a saved video record.
    private async Task<string?> GetTranscriptTextAsync(string videoId, CancellationToken cancellationToken)
    {
        var cacheKey = TranscriptCacheKey(videoId);
        var ttl = TimeSpan.FromSeconds(_cacheOptions.TranscriptSeconds);

        var cached = await _cache.GetAsync<string>(cacheKey, cancellationToken);
        if (!string.IsNullOrEmpty(cached))
            return cached;

        var savedVideo = await _unitOfWork.YouTubeVideos.GetByVideoIdAsync(videoId, cancellationToken);
        if (savedVideo != null)
            return await GetOrFetchTranscriptAsync(savedVideo, cancellationToken);

        var storedSegments = await GetStoredTranscriptSegmentsAsync(videoId, SubtitlesKind, cancellationToken)
                             ?? await GetStoredTranscriptSegmentsAsync(videoId, TranscriptKind, cancellationToken);
        if (storedSegments is { Count: > 0 })
        {
            var storedTranscript = string.Join(" ", storedSegments.Select(s => s.Text));
            await _cache.SetAsync(cacheKey, storedTranscript, ttl, cancellationToken);
            return storedTranscript;
        }

        var segments = await _transcriptService.GetSubtitlesAsync(videoId, cancellationToken);
        var transcriptKind = SubtitlesKind;
        if (segments == null || segments.Count == 0)
        {
            segments = await _transcriptService.GetTranscriptAsync(videoId, cancellationToken);
            transcriptKind = TranscriptKind;
        }
        if (segments == null || segments.Count == 0) return null;

        var dtos = segments.Select(s => new TranscriptSegmentDto(s.Start.TotalSeconds, s.Text)).ToList();
        var transcript = string.Join(" ", dtos.Select(s => s.Text));
        await StoreTranscriptSegmentsAsync(videoId, transcriptKind, dtos, ttl, cancellationToken);
        await _cache.SetAsync(cacheKey, transcript, ttl, cancellationToken);
        return transcript;
    }

    private async Task<string?> GetTranscriptTimelineTextAsync(string videoId, CancellationToken cancellationToken)
    {
        var cacheKey = TranscriptSegmentsCacheKey(videoId);
        var ttl = TimeSpan.FromSeconds(_cacheOptions.TranscriptSeconds);

        var cached = await _cache.GetAsync<List<TranscriptSegmentDto>>(cacheKey, cancellationToken);
        if (cached is { Count: > 0 })
            return FormatTranscriptSegments(cached);

        var storedSegments = await GetStoredTranscriptSegmentsAsync(videoId, TranscriptKind, cancellationToken)
                             ?? await GetStoredTranscriptSegmentsAsync(videoId, SubtitlesKind, cancellationToken);
        if (storedSegments is { Count: > 0 })
        {
            await _cache.SetAsync(cacheKey, storedSegments, ttl, cancellationToken);
            return FormatTranscriptSegments(storedSegments);
        }

        var segments = await _transcriptService.GetSubtitlesAsync(videoId, cancellationToken);
        var transcriptKind = SubtitlesKind;
        if (segments == null || segments.Count == 0)
        {
            segments = await _transcriptService.GetTranscriptAsync(videoId, cancellationToken);
            transcriptKind = TranscriptKind;
        }
        if (segments is { Count: > 0 })
        {
            var dtos = segments.Select(s => new TranscriptSegmentDto(s.Start.TotalSeconds, s.Text)).ToList();
            await StoreTranscriptSegmentsAsync(videoId, transcriptKind, dtos, ttl, cancellationToken);
            await _cache.SetAsync(cacheKey, dtos, ttl, cancellationToken);
            return FormatTranscriptSegments(dtos);
        }

        return await GetTranscriptTextAsync(videoId, cancellationToken);
    }

    private static List<TranscriptSegmentDto> PrepareTranscriptSegments(IEnumerable<TranscriptSegmentDto> segments)
        => SegmentTranscriptForReading(segments)
            .Select(s => new TranscriptSegmentDto(s.StartSeconds, NormalizeTranscriptSentence(s.Text)))
            .ToList();

    private static List<TranscriptSegmentDto> SegmentTranscriptForReading(IEnumerable<TranscriptSegmentDto> segments)
    {
        var ordered = segments
            .Where(s => !string.IsNullOrWhiteSpace(s.Text))
            .OrderBy(s => s.StartSeconds)
            .ToList();

        if (ordered.Count <= 1)
            return ordered;

        var result = new List<TranscriptSegmentDto>();
        var segmentStart = ordered[0].StartSeconds;
        var segmentText = new StringBuilder();

        for (var i = 0; i < ordered.Count; i++)
        {
            var current = ordered[i];
            var currentStart = current.StartSeconds;
            var nextStart = i + 1 < ordered.Count ? ordered[i + 1].StartSeconds : (double?)null;
            var elapsedToCurrent = currentStart - segmentStart;

            if (segmentText.Length > 0 && elapsedToCurrent >= MinTranscriptSegmentSeconds)
            {
                result.Add(new TranscriptSegmentDto(segmentStart, segmentText.ToString()));
                segmentText.Clear();
                segmentStart = currentStart;
            }

            if (segmentText.Length == 0)
                segmentStart = currentStart;
            else
                segmentText.Append(' ');

            segmentText.Append(current.Text.Trim());

            if (nextStart.HasValue && nextStart.Value - segmentStart >= MaxTranscriptSegmentSeconds)
            {
                result.Add(new TranscriptSegmentDto(segmentStart, segmentText.ToString()));
                segmentText.Clear();
            }
        }

        if (segmentText.Length > 0)
            result.Add(new TranscriptSegmentDto(segmentStart, segmentText.ToString()));

        MergeShortTrailingSegment(result);
        return result;
    }

    private static void MergeShortTrailingSegment(List<TranscriptSegmentDto> segments)
    {
        if (segments.Count < 2)
            return;

        var last = segments[^1];
        var previous = segments[^2];
        var trailingDuration = last.StartSeconds - previous.StartSeconds;

        if (trailingDuration >= MinTranscriptSegmentSeconds)
            return;

        segments[^2] = previous with { Text = $"{previous.Text.Trim()} {last.Text.Trim()}" };
        segments.RemoveAt(segments.Count - 1);
    }

    private static string NormalizeTranscriptSentence(string text)
    {
        text = Regex.Replace(text.Trim(), @"\s+([,.;:!?])", "$1");
        text = AddCommonCommas(text);
        if (text.Length == 0)
            return text;

        text = char.ToUpperInvariant(text[0]) + text[1..];
        return EndsWithSentencePunctuation(text) ? text : text + ".";
    }

    private static bool EndsWithSentencePunctuation(string text)
        => text.EndsWith('.') || text.EndsWith('!') || text.EndsWith('?')
           || text.EndsWith('。') || text.EndsWith('！') || text.EndsWith('？');

    private static string AddCommonCommas(string text)
    {
        text = Regex.Replace(
            text,
            @"^(however|therefore|meanwhile|first|second|third|finally|for example|in addition|on the other hand)\s+",
            match => match.Groups[1].Value + ", ",
            RegexOptions.IgnoreCase);

        return Regex.Replace(
            text,
            @"\s+(however|although|though|whereas|while|but|which)\s+",
            match => ", " + match.Groups[1].Value + " ",
            RegexOptions.IgnoreCase);
    }

    private static string FormatTranscriptSegments(IEnumerable<TranscriptSegmentDto> segments)
    {
        var list = segments
            .Where(s => !string.IsNullOrWhiteSpace(s.Text))
            .ToList();

        var lines = new List<string>();
        for (var i = 0; i < list.Count; i++)
        {
            var start = list[i].StartSeconds;
            var end = i + 1 < list.Count ? list[i + 1].StartSeconds : start;
            var timestamp = end > start
                ? $"{MediaFormatting.FormatTimestamp(start)} – {MediaFormatting.FormatTimestamp(end)}"
                : MediaFormatting.FormatTimestamp(start);
            lines.Add($"{timestamp} {list[i].Text.Trim()}");
        }

        return string.Join('\n', lines);
    }

    private static List<TranscriptSegmentDto> ParseWhisperTranscriptDtos(string transcriptJson)
    {
        try
        {
            var chunks = JsonSerializer.Deserialize<List<WhisperTranscriptChunk>>(transcriptJson, new JsonSerializerOptions
            {
                PropertyNameCaseInsensitive = true
            }) ?? [];

            return chunks
                .Where(c => !string.IsNullOrWhiteSpace(c.Text))
                .Select(c => new TranscriptSegmentDto(c.Start, c.Text.Trim()))
                .ToList();
        }
        catch
        {
            return [];
        }
    }

    private sealed record WhisperTranscriptChunk(double Start, double End, string Text);

}
