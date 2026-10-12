using System.Text.RegularExpressions;

namespace StudyPlatform.Application.Services;

/// <summary>Text-to-speech: returns an MP3 of <c>text</c> read in <c>voice</c>.</summary>
public interface ISpeechSynthesizer
{
    Task<byte[]> SynthesizeAsync(string text, string voice, CancellationToken cancellationToken);
}

/// <summary>What a synthesis request may ask for.</summary>
public static partial class SpeechRequests
{
    public const string DefaultVoice = "en-US-AriaNeural";

    /// <summary>
    /// Above the 5,000 characters the clients split long text into (packages/core textChunks.ts), so no
    /// legitimate request is refused, while one request can't occupy a synthesis slot for minutes.
    /// </summary>
    public const int MaxTextChars = 6_000;

    /// <summary>An Edge neural voice id such as "en-US-AriaNeural" or "zh-CN-shaanxi-XiaoniNeural".</summary>
    public static bool IsValidVoice(string voice) => voice.Length <= 64 && VoicePattern().IsMatch(voice);

    [GeneratedRegex(@"^[A-Za-z]{2,3}(-[A-Za-z0-9]+){1,3}Neural$")]
    private static partial Regex VoicePattern();
}
