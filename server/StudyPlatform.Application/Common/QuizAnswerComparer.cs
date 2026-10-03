using System.Text.RegularExpressions;

namespace StudyPlatform.Application.Common;

/// <summary>
/// Decides whether a stored answer matches a quiz's correct answer. This is a faithful
/// server-side port of the frontend <c>isQuizOptionCorrect</c> helper (web/src/utils/quizAnswers.ts)
/// so that mistake counts computed on the server match what the UI would show. It tolerates the
/// several ways an answer can be stored: full option text, a bare option letter ("B"), text with a
/// letter prefix ("B) ..."), or semantically-equivalent wording.
/// </summary>
public static partial class QuizAnswerComparer
{
    public static bool IsCorrect(string? option, string? answer)
    {
        if (string.IsNullOrWhiteSpace(option) || string.IsNullOrWhiteSpace(answer))
            return false;

        var normalizedOption = NormalizeAnswerText(option);
        var normalizedAnswer = NormalizeAnswerText(answer);
        if (normalizedOption == normalizedAnswer)
            return true;

        var optionLetter = GetOptionLetter(option);
        if (optionLetter != null && IsBareOptionLetter(answer) && optionLetter == GetOptionLetter(answer))
            return true;

        var optionBody = NormalizeAnswerText(StripOptionPrefix(option));
        var answerBody = NormalizeAnswerText(StripOptionPrefix(answer));
        if (optionBody.Length > 0 && optionBody == answerBody)
            return true;

        var optionMeaning = NormalizeMeaning(option);
        var answerMeaning = NormalizeMeaning(answer);
        return optionMeaning.Length > 0 && optionMeaning == answerMeaning;
    }

    private static string NormalizeAnswerText(string value) =>
        WhitespaceRegex().Replace(value.Trim(), " ").ToLowerInvariant();

    private static string StripOptionPrefix(string value) =>
        OptionPrefixRegex().Replace(value.Trim(), string.Empty).Trim();

    private static string NormalizeMeaning(string value)
    {
        var stripped = StripOptionPrefix(value).ToLowerInvariant().Replace("&", " and ");
        stripped = AndWordRegex().Replace(stripped, " ");
        stripped = NonAlphanumericRegex().Replace(stripped, " ").Trim();
        return WhitespaceRegex().Replace(stripped, " ");
    }

    private static string? GetOptionLetter(string value)
    {
        var match = LeadingLetterRegex().Match(value.Trim());
        return match.Success ? match.Groups[1].Value.ToUpperInvariant() : null;
    }

    private static bool IsBareOptionLetter(string value) => BareLetterRegex().IsMatch(value.Trim());

    [GeneratedRegex(@"^[A-D][).:\s]+", RegexOptions.IgnoreCase)]
    private static partial Regex OptionPrefixRegex();

    [GeneratedRegex(@"^([A-D])(?:[).:\s]|$)", RegexOptions.IgnoreCase)]
    private static partial Regex LeadingLetterRegex();

    [GeneratedRegex(@"^[A-D]$", RegexOptions.IgnoreCase)]
    private static partial Regex BareLetterRegex();

    [GeneratedRegex(@"\b(and)\b")]
    private static partial Regex AndWordRegex();

    [GeneratedRegex(@"[^a-z0-9]+")]
    private static partial Regex NonAlphanumericRegex();

    [GeneratedRegex(@"\s+")]
    private static partial Regex WhitespaceRegex();
}
