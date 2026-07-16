namespace StudyPlatform.Application.Services;

public interface ITtsSynthesisService
{
    /// <summary>Synthesizes text to MP3 bytes with the given voice (e.g. "en-US-AriaNeural").</summary>
    Task<byte[]> SynthesizeAsync(string text, string voice, CancellationToken cancellationToken = default);
}
