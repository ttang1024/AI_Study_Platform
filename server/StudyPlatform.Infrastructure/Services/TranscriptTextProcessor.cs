using System.Net;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
using StudyPlatform.Application.Services;

namespace StudyPlatform.Infrastructure.Services;

/// <summary>
/// Pure transcript/caption text processing: cleaning, Whisper JSON parsing, and
/// re-segmenting raw caption lines into sentence-aligned 30-60s segments.
/// </summary>
internal static class TranscriptTextProcessor
{
    public static string CleanCaptionText(string text)
    {
        text = WebUtility.HtmlDecode(text);
        text = text.Replace('\n', ' ').Replace('\r', ' ');
        text = Regex.Replace(text, @"\s+", " ");
        return text.Trim();
    }

    public static IReadOnlyList<TranscriptSegment> ParseWhisperTranscript(string transcriptJson)
    {
        var chunks = System.Text.Json.JsonSerializer.Deserialize<List<WhisperTranscriptChunk>>(transcriptJson, new JsonSerializerOptions
        {
            PropertyNameCaseInsensitive = true
        });

        return chunks?
            .Where(c => !string.IsNullOrWhiteSpace(c.Text))
            .Select(c => new TranscriptSegment(TimeSpan.FromSeconds(c.Start), c.Text.Trim()))
            .ToList()
            ?? [];
    }

    private sealed record WhisperTranscriptChunk(double Start, double End, string Text);

    // ── Phase 1: merge caption lines into complete sentences ─────────────
    // A new sentence begins when the accumulated text ends with . ! ?
    // OR there is a silence gap > 2 s between consecutive captions,
    // OR the accumulated time reaches 30 s (fallback for subtitle-only tracks
    // that have no punctuation and no gaps).
    // ── Phase 2: group sentences into 30-60 second segments ──────────────
    // A new segment is emitted once the accumulated duration >= 30 s
    // (always at a sentence boundary). A segment is force-closed at 60 s.
    public static IReadOnlyList<TranscriptSegment> Resegment(
        IReadOnlyList<(TimeSpan Offset, TimeSpan Duration, string Text)> captions)
    {
        // ── Phase 1 ──────────────────────────────────────────────────────
        var sentences = new List<(TimeSpan Start, string Text)>();
        var sentStart = captions[0].Offset;
        var sb = new StringBuilder();

        for (int i = 0; i < captions.Count; i++)
        {
            var (offset, duration, text) = captions[i];

            if (sb.Length == 0) sentStart = offset;
            else sb.Append(' ');
            sb.Append(text);

            var current = sb.ToString().TrimEnd();
            bool sentenceEnd = EndsWithSentencePunctuation(current);

            bool silenceGap = i < captions.Count - 1
                && (captions[i + 1].Offset - (offset + duration)).TotalSeconds > 2.0;

            bool lastCaption = i == captions.Count - 1;

            bool timeBreak = (offset - sentStart).TotalSeconds >= 30.0;

            if (sentenceEnd || silenceGap || lastCaption || timeBreak)
            {
                if (current.Length > 0)
                    sentences.Add((sentStart, NormalizeSentencePunctuation(current)));
                sb.Clear();
            }
        }

        if (sentences.Count == 0) return [];

        // ── Phase 2: time-based segmentation (30-60 s) ───────────────────
        const double minSegmentSeconds = 30.0;
        const double maxSegmentSeconds = 60.0;

        var result = new List<TranscriptSegment>();
        var segStart = sentences[0].Start;
        var segSb = new StringBuilder();

        for (int i = 0; i < sentences.Count; i++)
        {
            var (start, text) = sentences[i];
            if (segSb.Length == 0) segStart = start;
            if (segSb.Length > 0) segSb.Append(' ');
            segSb.Append(text);

            bool isLast = i == sentences.Count - 1;

            double nextStartSec = isLast
                ? start.TotalSeconds + 5.0
                : sentences[i + 1].Start.TotalSeconds;
            double segDuration = nextStartSec - segStart.TotalSeconds;

            if (segDuration >= minSegmentSeconds || segDuration >= maxSegmentSeconds || isLast)
            {
                result.Add(new TranscriptSegment(segStart, segSb.ToString().Trim()));
                segSb.Clear();
            }
        }

        return result;
    }

    private static string NormalizeSentencePunctuation(string text)
    {
        text = Regex.Replace(text.Trim(), @"\s+([,.;:!?])", "$1");
        text = AddCommonCommas(text);
        if (text.Length == 0)
            return text;

        text = char.ToUpperInvariant(text[0]) + text[1..];
        if (EndsWithSentencePunctuation(text))
            return text;

        return text + ".";
    }

    private static bool EndsWithSentencePunctuation(string text)
        => text.EndsWith('.') || text.EndsWith('!') || text.EndsWith('?')
           || text.EndsWith('。') || text.EndsWith('！') || text.EndsWith('？');

    private static string AddCommonCommas(string text)
    {
        text = Regex.Replace(
            text,
            @"^(however|therefore|meanwhile|first|second|third|finally|for example|in addition|on the other hand)\s+",
            match => match.Groups[1].Value + ", ",
            RegexOptions.IgnoreCase);

        return Regex.Replace(
            text,
            @"\s+(however|although|though|whereas|while|but|which)\s+",
            match => ", " + match.Groups[1].Value + " ",
            RegexOptions.IgnoreCase);
    }
}
