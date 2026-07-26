using System.Text;
using System.Text.Json;

namespace StudyPlatform.Application.Common;

/// <summary>
/// Where a generated artifact came from in its source material.
///
/// <para>Offsets are into the extracted plain text of the source, not the original file. They are
/// null when the quote could not be located — a citation that points nowhere is better than one
/// that points somewhere wrong, and the UI renders the quote alone in that case.</para>
/// </summary>
public record SourceAnchor(
    string Quote,
    int? StartOffset = null,
    int? EndOffset = null,
    int? Page = null,
    double? StartSeconds = null)
{
    /// <summary>True when the anchor can be turned into a jump target rather than just a quotation.</summary>
    public bool IsLocated => StartOffset.HasValue && EndOffset.HasValue;
}

/// <summary>
/// Locates a model-supplied quote inside the source text it was generated from.
///
/// <para>The reason this exists: language models cannot count characters, so asking one for an
/// offset produces a confident, wrong number. Asking for a short verbatim quote and locating it
/// ourselves is the only way to get an anchor that actually lands on the right text.</para>
///
/// <para>Models do not quote perfectly either — they normalize whitespace, straighten quotes, fix
/// the source's typos, and truncate. So matching degrades in stages, and refuses rather than
/// guessing when confidence is low.</para>
/// </summary>
public static class SourceAnchorResolver
{
    /// <summary>
    /// Minimum fraction of the quote's words that must appear, in order, in the candidate window for
    /// a fuzzy match to be accepted. Chosen so a model that rewords one word in six still anchors,
    /// while a hallucinated quote sharing only stopwords does not.
    /// </summary>
    private const double MinimumFuzzyScore = 0.75;

    /// <summary>Quotes shorter than this carry too little signal to locate uniquely.</summary>
    private const int MinimumQuoteLength = 12;

    /// <summary>
    /// Resolves <paramref name="quote"/> within <paramref name="sourceText"/>.
    /// Returns null when there is no source text, the quote is too short, or no candidate scores
    /// above the acceptance threshold.
    /// </summary>
    public static SourceAnchor? Resolve(string? sourceText, string? quote)
    {
        if (string.IsNullOrWhiteSpace(sourceText) || string.IsNullOrWhiteSpace(quote))
            return null;

        var trimmedQuote = quote.Trim();
        if (trimmedQuote.Length < MinimumQuoteLength)
            return null;

        var haystack = Normalized.From(sourceText);
        var needle = Normalized.From(trimmedQuote);

        if (needle.Text.Length == 0)
            return null;

        // 1. Exact match on the normalized text. Covers the common case, where the only difference
        //    between quote and source is whitespace and punctuation shape.
        var index = haystack.Text.IndexOf(needle.Text, StringComparison.Ordinal);
        if (index >= 0)
            return Anchor(trimmedQuote, haystack, index, needle.Text.Length);

        // 2. Leading-window match. Models frequently truncate a long quote or tack on a trailing
        //    paraphrase; the opening words are far more reliable than the closing ones.
        var prefix = FirstWords(needle.Text, 8);
        if (prefix.Length >= MinimumQuoteLength)
        {
            index = haystack.Text.IndexOf(prefix, StringComparison.Ordinal);
            if (index >= 0)
                return Anchor(trimmedQuote, haystack, index, Math.Min(needle.Text.Length, haystack.Text.Length - index));
        }

        // 3. Fuzzy: slide a window the size of the quote and score by ordered word containment.
        var fuzzy = BestFuzzyWindow(haystack.Text, needle.Text);
        if (fuzzy is { } hit && hit.Score >= MinimumFuzzyScore)
            return Anchor(trimmedQuote, haystack, hit.Start, hit.Length);

        return null;
    }

    /// <summary>
    /// Resolves a quote and additionally attributes it to a page, using markers left by the text
    /// extractor. Pages are 1-based; null when the source carries no page markers.
    /// </summary>
    public static SourceAnchor? ResolveWithPages(string? sourceText, string? quote, IReadOnlyList<int>? pageStartOffsets)
    {
        var anchor = Resolve(sourceText, quote);
        if (anchor == null || !anchor.IsLocated || pageStartOffsets == null || pageStartOffsets.Count == 0)
            return anchor;

        // Last page whose start offset precedes the match.
        var page = 0;
        for (var i = 0; i < pageStartOffsets.Count; i++)
        {
            if (pageStartOffsets[i] <= anchor.StartOffset!.Value) page = i + 1;
            else break;
        }

        return page > 0 ? anchor with { Page = page } : anchor;
    }

    /// <summary>
    /// Resolves a quote against a timed transcript and attributes it to the segment it falls in.
    /// Segments must be ordered by start time and their text concatenated in the same order that
    /// produced <paramref name="sourceText"/>.
    /// </summary>
    public static SourceAnchor? ResolveWithTimestamps(
        string? sourceText, string? quote, IReadOnlyList<(double StartSeconds, int TextOffset)>? segments)
    {
        var anchor = Resolve(sourceText, quote);
        if (anchor == null || !anchor.IsLocated || segments == null || segments.Count == 0)
            return anchor;

        double? start = null;
        foreach (var segment in segments)
        {
            if (segment.TextOffset <= anchor.StartOffset!.Value) start = segment.StartSeconds;
            else break;
        }

        return start.HasValue ? anchor with { StartSeconds = start } : anchor;
    }

    public static string Serialize(SourceAnchor anchor) => JsonSerializer.Serialize(anchor);

    public static SourceAnchor? Deserialize(string? json)
    {
        if (string.IsNullOrWhiteSpace(json)) return null;
        try
        {
            return JsonSerializer.Deserialize<SourceAnchor>(json);
        }
        catch (JsonException)
        {
            return null;
        }
    }

    // ── Internals ────────────────────────────────────────────────────────────

    private static SourceAnchor Anchor(string quote, Normalized haystack, int normalizedStart, int normalizedLength)
    {
        var start = haystack.ToOriginalIndex(normalizedStart);

        // Map the *last* character of the match, not the one past it: the normalized index one past
        // the match belongs to the following character, whose original position is past the quote —
        // and after a collapsed whitespace run it can be several characters past. Mapping that and
        // adding one made every highlight overshoot the passage it was citing.
        var lastNormalizedIndex = Math.Min(normalizedStart + normalizedLength, haystack.Text.Length) - 1;
        var end = haystack.ToOriginalIndex(lastNormalizedIndex) + 1;

        return new SourceAnchor(quote, start, Math.Max(end, start + 1));
    }

    private static string FirstWords(string text, int count)
    {
        var taken = 0;
        for (var i = 0; i < text.Length; i++)
        {
            if (text[i] != ' ') continue;
            if (++taken == count) return text[..i];
        }
        return text;
    }

    private readonly record struct FuzzyHit(int Start, int Length, double Score);

    /// <summary>
    /// Scores windows of the haystack by what fraction of the needle's words they contain in order.
    /// Steps by word rather than character — a character-wise scan of a long document against every
    /// candidate quote is quadratic for no extra accuracy.
    /// </summary>
    private static FuzzyHit? BestFuzzyWindow(string haystack, string needle)
    {
        var needleWords = needle.Split(' ', StringSplitOptions.RemoveEmptyEntries);
        if (needleWords.Length < 3) return null;

        var wordStarts = new List<int>();
        for (var i = 0; i < haystack.Length; i++)
        {
            if (i == 0 || haystack[i - 1] == ' ') wordStarts.Add(i);
        }
        if (wordStarts.Count == 0) return null;

        FuzzyHit? best = null;

        foreach (var start in wordStarts)
        {
            var length = Math.Min(needle.Length, haystack.Length - start);
            if (length < needle.Length / 2) break;

            var window = haystack.AsSpan(start, length);
            var score = OrderedContainment(window, needleWords);

            if (best is null || score > best.Value.Score)
                best = new FuzzyHit(start, length, score);

            // Nothing will beat a perfect score; stop early on long documents.
            if (score >= 0.999) break;
        }

        return best;
    }

    /// <summary>
    /// Fraction of needle words found in the window, scanning forward only so that word *order* is
    /// respected. An unordered bag-of-words score matches any window that happens to reuse the same
    /// vocabulary, which for study material is most of them.
    /// </summary>
    private static double OrderedContainment(ReadOnlySpan<char> window, string[] needleWords)
    {
        var searchFrom = 0;
        var found = 0;

        foreach (var word in needleWords)
        {
            if (searchFrom >= window.Length) break;

            var at = window[searchFrom..].IndexOf(word, StringComparison.Ordinal);
            if (at < 0) continue;

            found++;
            searchFrom += at + word.Length;
        }

        return (double)found / needleWords.Length;
    }

    /// <summary>
    /// A whitespace- and punctuation-normalized view of a string that can map any index in the
    /// normalized text back to the corresponding index in the original.
    /// </summary>
    private sealed class Normalized
    {
        public string Text { get; private init; } = string.Empty;
        private int[] _map = Array.Empty<int>();

        public int ToOriginalIndex(int normalizedIndex)
        {
            if (_map.Length == 0) return 0;
            var clamped = Math.Clamp(normalizedIndex, 0, _map.Length - 1);
            return _map[clamped];
        }

        public static Normalized From(string source)
        {
            var builder = new StringBuilder(source.Length);
            var map = new List<int>(source.Length);
            var lastWasSpace = true; // suppresses leading whitespace

            for (var i = 0; i < source.Length; i++)
            {
                var c = Canonicalize(source[i]);

                if (char.IsWhiteSpace(c))
                {
                    if (lastWasSpace) continue;
                    builder.Append(' ');
                    map.Add(i);
                    lastWasSpace = true;
                    continue;
                }

                builder.Append(char.ToLowerInvariant(c));
                map.Add(i);
                lastWasSpace = false;
            }

            // Trailing space carries no signal and would skew length comparisons.
            if (builder.Length > 0 && builder[^1] == ' ')
            {
                builder.Length--;
                map.RemoveAt(map.Count - 1);
            }

            return new Normalized { Text = builder.ToString(), _map = map.ToArray() };
        }

        /// <summary>
        /// Folds the typographic variants that differ between a PDF's extracted text and what a model
        /// echoes back: curly quotes, the various dashes, and non-breaking spaces.
        /// </summary>
        private static char Canonicalize(char c) => c switch
        {
            '‘' or '’' or 'ʼ' => '\'',
            '“' or '”' => '"',
            '–' or '—' or '−' => '-',
            ' ' or ' ' or ' ' => ' ',
            _ => c
        };
    }
}
