using System.Text.RegularExpressions;

namespace StudyPlatform.Application.Practice.Queries;

/// <summary>
/// One item in a practice test. <c>Format</c> is "mc" (auto-graded multiple choice) or "recall"
/// (self-graded — the learner reveals the answer and rates themselves). <c>Answer</c> is the
/// correct option text (mc) or the back/definition/solution (recall).
/// </summary>
public record PracticeQuestionDto(
    string Id,
    string Source,          // quiz | glossary | flashcard | problem
    string SourceId,
    string Format,          // mc | recall
    string Prompt,
    string[]? Options,
    string Answer,
    string? Explanation,
    string Difficulty,
    string? CourseId);

public record PracticeTestDto(IReadOnlyList<PracticeQuestionDto> Questions, int Count, DateTime GeneratedAt);

public record PracticeResultItem(string Source, Guid SourceId, bool IsCorrect);

public record SubmitPracticeTestRequest(IReadOnlyList<PracticeResultItem> Results);

public record PracticeTestSummaryDto(int Total, int Correct, double AccuracyPercent);

/// <summary>
/// Turns a flashcard into a practice prompt/answer pair. Cloze cards carry their
/// answer inline as <c>{{term}}</c> in the front (the back is often empty), so the
/// terms are blanked out of the prompt and surfaced as the answer.
/// </summary>
public static class PracticeFlashcardFormat
{
    private static readonly Regex ClozeRegex = new(@"\{\{([^}]+)\}\}", RegexOptions.Compiled);

    /// <summary>Null when the card has no answer to reveal (no cloze terms and a blank back).</summary>
    public static (string Prompt, string Answer)? ToPromptAnswer(string front, string? back)
    {
        var matches = ClozeRegex.Matches(front);
        if (matches.Count == 0)
            return string.IsNullOrWhiteSpace(back) ? null : (front, back!);

        var prompt = ClozeRegex.Replace(front, "_____");
        var terms = string.Join(", ", matches.Select(m => m.Groups[1].Value.Trim()));
        var answer = string.IsNullOrWhiteSpace(back) ? terms : $"{terms} — {back}";
        return (prompt, answer);
    }
}
