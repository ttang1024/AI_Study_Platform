using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Logging;
using StudyPlatform.Application.Services;

namespace StudyPlatform.Infrastructure.Services;

// Whisper transcription fallback: audio download & speech-to-text.
public partial class YouTubeTranscriptService
{
    private async Task<IReadOnlyList<TranscriptSegment>?> GetWhisperTranscriptAsync(
        string videoId, CancellationToken ct)
    {
        var cacheKey = $"yt_whisper_transcript:{videoId}";
        if (_cache.TryGetValue(cacheKey, out IReadOnlyList<TranscriptSegment>? cached))
            return cached;

        try
        {
            var (audioData, mimeType) = await DownloadAudioAsync(videoId, ct);
            var transcriptJson = await _transcriptionService.TranscribeAsync(audioData, mimeType, ct);
            var segments = TranscriptTextProcessor.ParseWhisperTranscript(transcriptJson);

            if (segments.Count == 0) return null;

            _cache.Set(cacheKey, segments, TimeSpan.FromMinutes(10));
            return segments;
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Whisper fallback failed for YouTube video {VideoId}", videoId);
            return null;
        }
    }

    private async Task<IReadOnlyList<TranscriptSegment>?> GetWhisperTranscriptFromUrlAsync(
        string videoUrl, CancellationToken ct)
    {
        var cacheKey = $"video_whisper_transcript:{videoUrl}";
        if (_cache.TryGetValue(cacheKey, out IReadOnlyList<TranscriptSegment>? cached))
            return cached;

        try
        {
            var (audioData, mimeType) = await DownloadAudioFromUrlAsync(videoUrl, ct);
            var transcriptJson = await _transcriptionService.TranscribeAsync(audioData, mimeType, ct);
            var segments = TranscriptTextProcessor.ParseWhisperTranscript(transcriptJson);
            if (IsBilibiliUrl(videoUrl))
                segments = segments
                    .Select(s => new TranscriptSegment(s.Start, ToSimplifiedChinese(s.Text)))
                    .ToList();

            if (segments.Count == 0) return null;

            _cache.Set(cacheKey, segments, TimeSpan.FromMinutes(10));
            return segments;
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Whisper fallback failed for video URL {VideoUrl}", videoUrl);
            return null;
        }
    }

    private async Task<(byte[] AudioData, string MimeType)> DownloadAudioAsync(string videoId, CancellationToken ct)
    {
        var tempDir = Path.Combine(Path.GetTempPath(), $"yt-{Guid.NewGuid():N}");
        Directory.CreateDirectory(tempDir);
        try
        {
            await RunYtDlpAsync([
                "-x", "--audio-format", "m4a",
                "--no-playlist", "--no-warnings",
                "-o", Path.Combine(tempDir, "%(id)s.%(ext)s"),
                $"https://www.youtube.com/watch?v={videoId}"
            ], ct);

            var audioFile = Directory.GetFiles(tempDir).FirstOrDefault()
                ?? throw new InvalidOperationException($"yt-dlp produced no audio file for {videoId}");

            return (await File.ReadAllBytesAsync(audioFile, ct), "audio/mp4");
        }
        finally
        {
            if (Directory.Exists(tempDir))
                Directory.Delete(tempDir, recursive: true);
        }
    }

    private async Task<(byte[] AudioData, string MimeType)> DownloadAudioFromUrlAsync(string videoUrl, CancellationToken ct)
    {
        var tempDir = Path.Combine(Path.GetTempPath(), $"video-{Guid.NewGuid():N}");
        Directory.CreateDirectory(tempDir);
        try
        {
            await RunYtDlpAsync([
                "-x", "--audio-format", "m4a",
                "--no-playlist", "--no-warnings",
                "-o", Path.Combine(tempDir, "%(id)s.%(ext)s"),
                videoUrl
            ], ct);

            var audioFile = Directory.GetFiles(tempDir).FirstOrDefault()
                ?? throw new InvalidOperationException($"yt-dlp produced no audio file for {videoUrl}");

            return (await File.ReadAllBytesAsync(audioFile, ct), "audio/mp4");
        }
        finally
        {
            try { Directory.Delete(tempDir, recursive: true); } catch { }
        }
    }

    // ── Bilibili API ──────────────────────────────────────────────────────────

}
