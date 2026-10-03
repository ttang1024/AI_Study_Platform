using StudyPlatform.Infrastructure.Services;
using Xunit;

namespace StudyPlatform.Tests.Services;

public class AiResponseParsingTests
{
    // Builds a timestamped transcript spanning `minutes` of media, one line every 5 seconds,
    // matching the "MM:SS – MM:SS text" shape produced by FormatTranscriptSegments.
    private static string BuildTimedTranscript(int minutes)
    {
        var lines = new System.Collections.Generic.List<string>();
        var totalSeconds = minutes * 60;
        for (var s = 0; s < totalSeconds; s += 5)
        {
            var start = $"{s / 60:00}:{s % 60:00}";
            var endS = s + 5;
            var end = $"{endS / 60:00}:{endS % 60:00}";
            lines.Add($"{start} – {end} Segment spoken content around the {s} second mark of the talk.");
        }
        return string.Join('\n', lines);
    }

    private static int LastTimestampSeconds(string transcript)
    {
        var lastLine = transcript.Split('\n').Last(l => !string.IsNullOrWhiteSpace(l));
        var stamp = lastLine.Split(' ')[0]; // "MM:SS"
        var parts = stamp.Split(':');
        return int.Parse(parts[0]) * 60 + int.Parse(parts[1]);
    }

    [Fact]
    public void CondenseTimedTranscript_ShortTranscript_ReturnedUnchanged()
    {
        var transcript = BuildTimedTranscript(2);

        var result = AiResponseParsing.CondenseTimedTranscript(transcript);

        Assert.Equal(transcript, result);
    }

    [Fact]
    public void CondenseTimedTranscript_LongTranscript_FitsWithinBudget()
    {
        var transcript = BuildTimedTranscript(46);
        Assert.True(transcript.Length > 24000, "test fixture should exceed the budget");

        var result = AiResponseParsing.CondenseTimedTranscript(transcript);

        Assert.True(result.Length <= 24000);
    }

    [Fact]
    public void CondenseTimedTranscript_LongTranscript_PreservesFullTimeRange()
    {
        // The bug: a 46-min video produced a timeline that stopped at ~7 min because the tail
        // was truncated. The condensed transcript must still reach near the end of the media.
        var transcript = BuildTimedTranscript(46);

        var result = AiResponseParsing.CondenseTimedTranscript(transcript);

        // Starts at 0 and the final retained line is within the last minute of the video.
        Assert.StartsWith("00:00", result);
        Assert.True(LastTimestampSeconds(result) >= 45 * 60,
            $"last retained timestamp {LastTimestampSeconds(result)}s should be in the final minute of the 46-min video");
    }

    [Fact]
    public void CondenseTimedTranscript_KeepsChronologicalOrder()
    {
        var transcript = BuildTimedTranscript(46);

        var result = AiResponseParsing.CondenseTimedTranscript(transcript);

        var stamps = result.Split('\n')
            .Where(l => !string.IsNullOrWhiteSpace(l))
            .Select(l => l.Split(' ')[0])
            .Select(s => int.Parse(s.Split(':')[0]) * 60 + int.Parse(s.Split(':')[1]))
            .ToList();
        var sorted = stamps.OrderBy(x => x).ToList();
        Assert.Equal(sorted, stamps);
    }
}
