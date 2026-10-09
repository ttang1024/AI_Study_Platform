using StudyPlatform.Application.Videos.Transcripts;

namespace StudyPlatform.Application.Services;

/// <summary>
/// Durable storage for fetched transcript/subtitle segments, keyed by a video key and a
/// <see cref="TranscriptKinds"/> kind. Raw persistence only — segmenting for reading is the caller's job.
/// </summary>
public interface ITranscriptSegmentStore
{
    /// <summary>The stored segments, or null when absent, expired (and then removed) or unreadable.</summary>
    Task<List<TranscriptSegmentDto>?> GetAsync(string videoKey, string kind, CancellationToken cancellationToken);

    /// <summary>Insert or replace the segments, valid for <paramref name="ttl"/>.</summary>
    Task UpsertAsync(string videoKey, string kind, IReadOnlyCollection<TranscriptSegmentDto> segments, TimeSpan ttl, CancellationToken cancellationToken);
}
