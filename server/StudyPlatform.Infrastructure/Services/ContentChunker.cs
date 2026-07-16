using System.Text;

namespace StudyPlatform.Infrastructure.Services;

/// <summary>
/// Splits source text into overlapping, paragraph-aligned chunks for embedding.
/// </summary>
public static class ContentChunker
{
    public const int TargetChunkChars = 1200;

    /// <summary>
    /// Carried from the end of one chunk into the start of the next. Without it, a passage that
    /// straddles a chunk boundary is split across two vectors and matches neither query well.
    /// </summary>
    public const int OverlapChars = 150;

    /// <summary>Chunks below this length are folded into their neighbour rather than embedded alone.</summary>
    private const int MinChunkChars = 80;

    public static IReadOnlyList<string> Chunk(string text, int targetChars = TargetChunkChars, int overlapChars = OverlapChars)
    {
        if (string.IsNullOrWhiteSpace(text))
            return [];

        var paragraphs = SplitParagraphs(text);
        var chunks = new List<string>();
        var current = new StringBuilder();

        foreach (var paragraph in paragraphs)
        {
            // A single paragraph longer than the target can't be packed — hard-split it on its own.
            if (paragraph.Length > targetChars)
            {
                Flush(chunks, current);
                foreach (var slice in HardSplit(paragraph, targetChars, overlapChars))
                    chunks.Add(slice);
                continue;
            }

            if (current.Length > 0 && current.Length + paragraph.Length + 2 > targetChars)
            {
                var carry = TakeOverlap(current.ToString(), overlapChars);
                Flush(chunks, current);
                current.Append(carry);
            }

            if (current.Length > 0) current.Append("\n\n");
            current.Append(paragraph);
        }

        Flush(chunks, current);

        return Coalesce(chunks);
    }

    private static void Flush(List<string> chunks, StringBuilder buffer)
    {
        var text = buffer.ToString().Trim();
        if (text.Length > 0)
            chunks.Add(text);
        buffer.Clear();
    }

    private static IEnumerable<string> SplitParagraphs(string text)
        => text.Replace("\r\n", "\n")
            .Split("\n\n", StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Where(p => p.Length > 0);

    /// <summary>Splits an over-long paragraph on sentence ends where possible, mid-text otherwise.</summary>
    private static IEnumerable<string> HardSplit(string paragraph, int targetChars, int overlapChars)
    {
        var position = 0;
        while (position < paragraph.Length)
        {
            var length = Math.Min(targetChars, paragraph.Length - position);
            var end = position + length;

            if (end < paragraph.Length)
            {
                var boundary = paragraph.LastIndexOfAny(['.', '!', '?', '\n'], end - 1, Math.Min(length, 200));
                if (boundary > position)
                    end = boundary + 1;
            }

            var slice = paragraph[position..end].Trim();
            if (slice.Length > 0)
                yield return slice;

            if (end >= paragraph.Length)
                yield break;

            position = Math.Max(end - overlapChars, position + 1);
        }
    }

    private static string TakeOverlap(string text, int overlapChars)
    {
        if (overlapChars <= 0 || text.Length <= overlapChars)
            return string.Empty;

        var tail = text[^overlapChars..];

        // Start the carry at a word boundary so the next chunk doesn't open mid-word.
        var space = tail.IndexOf(' ');
        return space >= 0 ? tail[(space + 1)..] : tail;
    }

    /// <summary>Folds a runt trailing chunk into its predecessor — a 20-character chunk embeds to noise.</summary>
    private static List<string> Coalesce(List<string> chunks)
    {
        if (chunks.Count > 1 && chunks[^1].Length < MinChunkChars)
        {
            chunks[^2] = $"{chunks[^2]}\n\n{chunks[^1]}";
            chunks.RemoveAt(chunks.Count - 1);
        }

        return chunks.Where(c => c.Length > 0).ToList();
    }
}
