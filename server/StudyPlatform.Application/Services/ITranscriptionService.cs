namespace StudyPlatform.Application.Services;

public interface ITranscriptionService
{
    Task<string> TranscribeAsync(byte[] audioData, string mimeType, CancellationToken cancellationToken = default);
}
