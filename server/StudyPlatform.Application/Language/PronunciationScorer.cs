using System.Globalization;
using System.Text;

namespace StudyPlatform.Application.Language;

/// <summary>How one word of the target phrase fared.</summary>
public record WordScore(string Word, bool Correct);

public record PronunciationResult(
    string TargetPhrase,
    string Heard,
    /// <summary>0–100, the share of target words that were recognised in order.</summary>
    int Score,
    IReadOnlyList<WordScore> Words);

/// <summary>
/// Scores a spoken attempt by comparing a speech-to-text transcript against the phrase the learner
/// was asked to say.
///
/// <para>This is a proxy, not phonetic analysis: it measures whether a recogniser trained on the
/// target language understood the right words. That is a genuinely useful signal for a learner —
/// if the recogniser cannot make out the word, a listener probably could not either — but it cannot
/// distinguish a passable accent from a native one, and it will forgive a word that was mumbled
/// into an adjacent homophone.</para>
///
/// <para>Alignment is a longest-common-subsequence over normalized words rather than a set
/// intersection, so word order counts and a learner who says the right words in the wrong order
/// does not score full marks.</para>
/// </summary>
public static class PronunciationScorer
{
    public static PronunciationResult Score(string targetPhrase, string heard)
    {
        var targetWords = Tokenize(targetPhrase);
        var heardWords = Tokenize(heard);

        if (targetWords.Count == 0)
            return new PronunciationResult(targetPhrase, heard, 0, Array.Empty<WordScore>());

        var matchedIndices = LongestCommonSubsequenceIndices(targetWords, heardWords);

        var words = targetWords
            .Select((w, i) => new WordScore(w.Original, matchedIndices.Contains(i)))
            .ToList();

        var score = (int)Math.Round(100.0 * matchedIndices.Count / targetWords.Count);

        return new PronunciationResult(targetPhrase, heard, score, words);
    }

    private readonly record struct Token(string Original, string Normalized);

    /// <summary>
    /// Splits into words and normalizes for comparison: case folded, punctuation dropped, and
    /// accents stripped.
    ///
    /// <para>Accent stripping is deliberate. Speech-to-text output is inconsistent about diacritics
    /// even when the pronunciation was correct, so comparing them would mark learners down for the
    /// recogniser's spelling rather than their speech.</para>
    /// </summary>
    private static List<Token> Tokenize(string text)
    {
        if (string.IsNullOrWhiteSpace(text)) return new List<Token>();

        return text
            .Split(new[] { ' ', '\t', '\n', '\r' }, StringSplitOptions.RemoveEmptyEntries)
            .Select(raw => new Token(raw.Trim(), Normalize(raw)))
            .Where(t => t.Normalized.Length > 0)
            .ToList();
    }

    private static string Normalize(string word)
    {
        var decomposed = word.ToLowerInvariant().Normalize(NormalizationForm.FormD);
        var builder = new StringBuilder(decomposed.Length);

        foreach (var c in decomposed)
        {
            // Drop combining accents and anything that is not a letter or digit — apostrophes,
            // hyphens and terminal punctuation all vary freely in transcripts.
            if (CharUnicodeInfo.GetUnicodeCategory(c) == UnicodeCategory.NonSpacingMark) continue;
            if (char.IsLetterOrDigit(c)) builder.Append(c);
        }

        return builder.ToString();
    }

    /// <summary>
    /// Indices into <paramref name="target"/> that participate in the longest common subsequence
    /// with <paramref name="heard"/>. Standard LCS; phrases are short enough that the quadratic
    /// table is irrelevant.
    /// </summary>
    private static HashSet<int> LongestCommonSubsequenceIndices(List<Token> target, List<Token> heard)
    {
        var n = target.Count;
        var m = heard.Count;
        var table = new int[n + 1, m + 1];

        for (var i = n - 1; i >= 0; i--)
        {
            for (var j = m - 1; j >= 0; j--)
            {
                table[i, j] = target[i].Normalized == heard[j].Normalized
                    ? table[i + 1, j + 1] + 1
                    : Math.Max(table[i + 1, j], table[i, j + 1]);
            }
        }

        var matched = new HashSet<int>();
        var x = 0;
        var y = 0;

        while (x < n && y < m)
        {
            if (target[x].Normalized == heard[y].Normalized)
            {
                matched.Add(x);
                x++;
                y++;
            }
            else if (table[x + 1, y] >= table[x, y + 1])
            {
                x++;
            }
            else
            {
                y++;
            }
        }

        return matched;
    }
}
