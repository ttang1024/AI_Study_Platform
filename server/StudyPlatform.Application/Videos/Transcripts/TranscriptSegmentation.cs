using System.Text;
using System.Text.Json;
using StudyPlatform.Application.Common;

namespace StudyPlatform.Application.Videos.Transcripts;

/// <summary>
/// Pure transforms over transcript segments: regrouping caption fragments into readable 30–60 second
/// passages, rendering them as a timestamped timeline, and parsing Whisper output.
/// </summary>
public static class TranscriptSegmentation
{
    private const double MinSegmentSeconds = 30.0;
    private const double MaxSegmentSeconds = 60.0;

    public static List<TranscriptSegmentDto> Prepare(IEnumerable<TranscriptSegmentDto> segments)
        => SegmentForReading(segments)
            .Select(s => new TranscriptSegmentDto(s.StartSeconds, TranscriptSentences.Normalize(s.Text)))
            .ToList();

    public static List<TranscriptSegmentDto> SegmentForReading(IEnumerable<TranscriptSegmentDto> segments)
    {
        var ordered = segments
            .Where(s => !string.IsNullOrWhiteSpace(s.Text))
            .OrderBy(s => s.StartSeconds)
            .ToList();

        if (ordered.Count <= 1)
            return ordered;

        var result = new List<TranscriptSegmentDto>();
        var segmentStart = ordered[0].StartSeconds;
        var segmentText = new StringBuilder();

        for (var i = 0; i < ordered.Count; i++)
        {
            var current = ordered[i];
            var currentStart = current.StartSeconds;
            var nextStart = i + 1 < ordered.Count ? ordered[i + 1].StartSeconds : (double?)null;
            var elapsedToCurrent = currentStart - segmentStart;

            if (segmentText.Length > 0 && elapsedToCurrent >= MinSegmentSeconds)
            {
                result.Add(new TranscriptSegmentDto(segmentStart, segmentText.ToString()));
                segmentText.Clear();
                segmentStart = currentStart;
            }

            if (segmentText.Length == 0)
                segmentStart = currentStart;
            else
                segmentText.Append(' ');

            segmentText.Append(current.Text.Trim());

            if (nextStart.HasValue && nextStart.Value - segmentStart >= MaxSegmentSeconds)
            {
                result.Add(new TranscriptSegmentDto(segmentStart, segmentText.ToString()));
                segmentText.Clear();
            }
        }

        if (segmentText.Length > 0)
            result.Add(new TranscriptSegmentDto(segmentStart, segmentText.ToString()));

        MergeShortTrailingSegment(result);
        return result;
    }

    private static void MergeShortTrailingSegment(List<TranscriptSegmentDto> segments)
    {
        if (segments.Count < 2)
            return;

        var last = segments[^1];
        var previous = segments[^2];
        var trailingDuration = last.StartSeconds - previous.StartSeconds;

        if (trailingDuration >= MinSegmentSeconds)
            return;

        segments[^2] = previous with { Text = $"{previous.Text.Trim()} {last.Text.Trim()}" };
        segments.RemoveAt(segments.Count - 1);
    }

    public static string Format(IEnumerable<TranscriptSegmentDto> segments)
    {
        var list = segments
            .Where(s => !string.IsNullOrWhiteSpace(s.Text))
            .ToList();

        var lines = new List<string>();
        for (var i = 0; i < list.Count; i++)
        {
            var start = list[i].StartSeconds;
            var end = i + 1 < list.Count ? list[i + 1].StartSeconds : start;
            var timestamp = end > start
                ? $"{MediaFormatting.FormatTimestamp(start)} – {MediaFormatting.FormatTimestamp(end)}"
                : MediaFormatting.FormatTimestamp(start);
            lines.Add($"{timestamp} {list[i].Text.Trim()}");
        }

        return string.Join('\n', lines);
    }

    public static List<TranscriptSegmentDto> ParseWhisper(string transcriptJson)
    {
        try
        {
            var chunks = JsonSerializer.Deserialize<List<WhisperTranscriptChunk>>(transcriptJson, new JsonSerializerOptions
            {
                PropertyNameCaseInsensitive = true
            }) ?? [];

            return chunks
                .Where(c => !string.IsNullOrWhiteSpace(c.Text))
                .Select(c => new TranscriptSegmentDto(c.Start, c.Text.Trim()))
                .ToList();
        }
        catch
        {
            return [];
        }
    }

    private sealed record WhisperTranscriptChunk(double Start, double End, string Text);
}
