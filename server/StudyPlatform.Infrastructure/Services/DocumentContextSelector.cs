using System.Text;
using System.Text.RegularExpressions;

namespace StudyPlatform.Infrastructure.Services;

/// <summary>
/// Picks the part of a document an AI answer about it should see.
///
/// <para>Chat and question answering used to send the document's first 3,000 characters, so anything
/// asked about page two onwards was answered from general knowledge. A document within
/// <see cref="DefaultBudgetChars"/> is now sent whole. A longer one is split with
/// <see cref="ContentChunker"/> and the chunks sharing the most terms with the question are kept, plus the
/// opening chunk (where a document usually says what it is about), in their original order.</para>
///
/// <para>Lexical scoring rather than embeddings: it costs nothing, needs no provider key, and works for
/// documents the embedding backfill hasn't reached. The trade-off is that a long document's context now
/// varies with the question, so the provider's prompt cache only hits for documents within budget.</para>
/// </summary>
public static partial class DocumentContextSelector
{
    /// <summary>About 6k tokens: room for a long chapter without crowding out the conversation.</summary>
    public const int DefaultBudgetChars = 24_000;

    private const string Gap = "\n\n[…]\n\n";

    public static string Select(string documentContent, string question, int budgetChars = DefaultBudgetChars)
    {
        if (string.IsNullOrEmpty(documentContent) || documentContent.Length <= budgetChars)
            return documentContent ?? string.Empty;

        var chunks = ContentChunker.Chunk(documentContent);
        if (chunks.Count == 0)
            return AiResponseParsing.TruncateContent(documentContent, budgetChars);

        var terms = Terms(question);
        var ranked = chunks
            .Select((text, index) => (Index: index, Score: index == 0 ? double.MaxValue : Score(text, terms)))
            .OrderByDescending(c => c.Score)
            .ThenBy(c => c.Index); // ties (including a question with no usable terms) favour earlier text

        var chosen = new SortedSet<int>();
        var used = 0;
        foreach (var (index, _) in ranked)
        {
            var cost = chunks[index].Length + Gap.Length;
            if (used + cost > budgetChars)
                continue;
            chosen.Add(index);
            used += cost;
        }

        var builder = new StringBuilder();
        var previous = -1;
        foreach (var index in chosen)
        {
            if (builder.Length > 0)
                builder.Append(index == previous + 1 ? "\n\n" : Gap);
            builder.Append(chunks[index]);
            previous = index;
        }
        if (previous < chunks.Count - 1)
            builder.Append(Gap);

        return builder.ToString();
    }

    /// <summary>Term-frequency overlap, normalised by chunk length so long chunks don't win by size alone.</summary>
    private static double Score(string chunk, HashSet<string> terms)
    {
        if (terms.Count == 0)
            return 0;

        var hits = 0;
        var words = 0;
        foreach (Match match in WordPattern().Matches(chunk))
        {
            words++;
            if (terms.Contains(match.Value.ToLowerInvariant()))
                hits++;
        }

        return words == 0 ? 0 : hits / Math.Sqrt(words);
    }

    private static HashSet<string> Terms(string question)
        => WordPattern().Matches(question ?? string.Empty)
            .Select(m => m.Value.ToLowerInvariant())
            .Where(w => w.Length > 2 && !StopWords.Contains(w))
            .ToHashSet();

    // Runs of letters/digits in any script. CJK text has no spaces, so a whole CJK clause is one "word"
    // and rarely matches; selection then falls back to document order, which is the old behaviour.
    [GeneratedRegex(@"[\p{L}\p{N}]+")]
    private static partial Regex WordPattern();

    private static readonly HashSet<string> StopWords = new(StringComparer.Ordinal)
    {
        "the", "and", "for", "are", "but", "not", "you", "all", "any", "can", "had", "her", "was", "one",
        "our", "out", "has", "have", "how", "what", "when", "where", "which", "who", "why", "this", "that",
        "with", "from", "they", "them", "their", "there", "these", "those", "into", "about", "does", "did",
        "its", "his", "she", "him", "will", "would", "could", "should", "explain", "tell", "please", "mean",
        "means", "document", "text", "say", "says",
    };
}
