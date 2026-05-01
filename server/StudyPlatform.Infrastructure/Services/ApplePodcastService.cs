using System.Text.Json;
using System.Web;
using StudyPlatform.Application.Services;

namespace StudyPlatform.Infrastructure.Services;

public class ApplePodcastService : IApplePodcastService
{
    private readonly HttpClient _httpClient;

    public ApplePodcastService(HttpClient httpClient)
    {
        _httpClient = httpClient;
    }

    public async Task<PodcastEpisodeInfo?> GetEpisodeInfoAsync(string applePodcastsUrl, CancellationToken cancellationToken = default)
    {
        try
        {
            var uri = new Uri(applePodcastsUrl.Trim());

            // Extract podcast ID from path segment like "id123456789"
            var segments = uri.AbsolutePath.Split('/', StringSplitOptions.RemoveEmptyEntries);
            var podcastIdSegment = segments.LastOrDefault(s =>
                s.StartsWith("id", StringComparison.OrdinalIgnoreCase) && long.TryParse(s[2..], out _));
            if (podcastIdSegment == null) return null;
            var podcastId = podcastIdSegment[2..];

            // Extract episode ID from query string (?i=XXXXX)
            var queryParams = HttpUtility.ParseQueryString(uri.Query);
            var episodeIdStr = queryParams["i"];
            if (!long.TryParse(episodeIdStr, out var episodeTrackId)) return null;

            // Fetch episodes from iTunes API
            var itunesUrl = $"https://itunes.apple.com/lookup?id={podcastId}&entity=podcastEpisode&limit=300";
            var response = await _httpClient.GetAsync(itunesUrl, cancellationToken);
            response.EnsureSuccessStatusCode();

            using var stream = await response.Content.ReadAsStreamAsync(cancellationToken);
            using var doc = await JsonDocument.ParseAsync(stream, cancellationToken: cancellationToken);

            var results = doc.RootElement.GetProperty("results");

            // First result is the podcast show itself
            string showName = "";
            string showThumbnail = "";
            if (results.GetArrayLength() > 0)
            {
                var show = results[0];
                showName = show.TryGetProperty("collectionName", out var cn) ? cn.GetString() ?? "" : "";
                showThumbnail = show.TryGetProperty("artworkUrl600", out var art) ? art.GetString() ?? "" : "";
            }

            // Find the specific episode by trackId
            foreach (var result in results.EnumerateArray())
            {
                if (!result.TryGetProperty("trackId", out var trackIdProp)) continue;
                if (trackIdProp.GetInt64() != episodeTrackId) continue;

                var title = result.TryGetProperty("trackName", out var tn) ? tn.GetString() ?? "" : "";
                var description = result.TryGetProperty("description", out var desc) ? desc.GetString() ?? "" : "";

                // episodeUrl is the direct audio URL; fall back to previewUrl
                var audioUrl = result.TryGetProperty("episodeUrl", out var eu) ? eu.GetString() ?? "" : "";
                if (string.IsNullOrEmpty(audioUrl))
                    audioUrl = result.TryGetProperty("previewUrl", out var pu) ? pu.GetString() ?? "" : "";

                var thumbnail = result.TryGetProperty("artworkUrl600", out var epArt)
                    ? epArt.GetString() ?? ""
                    : "";
                if (string.IsNullOrEmpty(thumbnail)) thumbnail = showThumbnail;

                var durationMs = result.TryGetProperty("trackTimeMillis", out var dur) ? dur.GetInt32() : 0;

                if (string.IsNullOrEmpty(audioUrl)) return null;

                return new PodcastEpisodeInfo(title, showName, audioUrl, thumbnail, description, durationMs);
            }

            return null;
        }
        catch
        {
            return null;
        }
    }

    public async Task<(byte[] AudioData, string MimeType)?> DownloadAudioAsync(string audioUrl, CancellationToken cancellationToken = default)
    {
        try
        {
            var response = await _httpClient.GetAsync(audioUrl, cancellationToken);
            response.EnsureSuccessStatusCode();
            var mimeType = response.Content.Headers.ContentType?.MediaType ?? "audio/mpeg";
            var bytes = await response.Content.ReadAsByteArrayAsync(cancellationToken);
            return (bytes, mimeType);
        }
        catch
        {
            return null;
        }
    }
}
