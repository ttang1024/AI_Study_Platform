namespace StudyPlatform.Domain.Projections;

/// <summary>A queued transcription that has not finished: enough to put it back on the queue.</summary>
public record PendingTranscription(Guid DocumentId, Guid UserId, string ContentType);

/// <summary>An uploaded video whose background transcription has not finished.</summary>
public record PendingVideoTranscription(Guid VideoRecordId, Guid UserId);
