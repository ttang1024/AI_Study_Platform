using System.Text.RegularExpressions;

namespace StudyPlatform.Application.Common;

/// <summary>
/// Sentence-level tidying applied to caption text before it is shown or fed to a model:
/// trailing punctuation, leading capital, and the commas auto-captions never emit.
/// Used by both the caption re-segmenter and the stored-transcript reader so the two agree.
/// </summary>
public static partial class TranscriptSentences
{
    public static string Normalize(string text)
    {
        text = SpaceBeforePunctuation().Replace(text.Trim(), "$1");
        text = AddCommonCommas(text);
        if (text.Length == 0)
            return text;

        text = char.ToUpperInvariant(text[0]) + text[1..];
        return EndsWithSentencePunctuation(text) ? text : text + ".";
    }

    public static bool EndsWithSentencePunctuation(string text)
        => text.EndsWith('.') || text.EndsWith('!') || text.EndsWith('?')
           || text.EndsWith('。') || text.EndsWith('！') || text.EndsWith('？');

    public static string AddCommonCommas(string text)
    {
        text = LeadingConnective().Replace(text, match => match.Groups[1].Value + ", ");
        return InlineConnective().Replace(text, match => ", " + match.Groups[1].Value + " ");
    }

    [GeneratedRegex(@"\s+([,.;:!?])")]
    private static partial Regex SpaceBeforePunctuation();

    [GeneratedRegex(@"^(however|therefore|meanwhile|first|second|third|finally|for example|in addition|on the other hand)\s+", RegexOptions.IgnoreCase)]
    private static partial Regex LeadingConnective();

    [GeneratedRegex(@"\s+(however|although|though|whereas|while|but|which)\s+", RegexOptions.IgnoreCase)]
    private static partial Regex InlineConnective();
}
