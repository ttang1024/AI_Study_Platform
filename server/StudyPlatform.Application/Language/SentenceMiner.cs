using System.Text.RegularExpressions;

namespace StudyPlatform.Application.Language;

/// <summary>
/// Turns a sentence met while reading or listening into a cloze card.
///
/// Sentence mining deliberately produces an ordinary flashcard rather than a language-specific
/// artifact: it then inherits FSRS scheduling, offline caching and the existing review UI. The value
/// is in meeting the word inside the sentence it was found in, not in a parallel subsystem.
/// </summary>
public static class SentenceMiner
{
    /// <summary>
    /// Wraps the first occurrence of <paramref name="targetWord"/> in the double braces the
    /// flashcard renderer treats as a blank. Returns null when the word is not in the sentence.
    ///
    /// <para>Whole-word and case-insensitive: blanking the "act" inside "practice" would produce a
    /// card that cannot be answered, and a learner who capitalised the word at the start of a
    /// sentence still meant the same word.</para>
    /// </summary>
    public static string? BuildCloze(string sentence, string targetWord)
    {
        if (string.IsNullOrWhiteSpace(sentence) || string.IsNullOrWhiteSpace(targetWord))
            return null;

        var pattern = $@"(?<![\w]){Regex.Escape(targetWord.Trim())}(?![\w])";
        var match = Regex.Match(sentence, pattern, RegexOptions.IgnoreCase);

        if (!match.Success) return null;

        return sentence[..match.Index]
               + "{{" + match.Value + "}}"
               + sentence[(match.Index + match.Length)..];
    }
}
