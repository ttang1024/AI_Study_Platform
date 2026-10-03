namespace StudyPlatform.Application.Common;

/// <summary>
/// Canonical quiz difficulty levels and normalization, shared across the document,
/// video and question-bank quiz features.
/// </summary>
public static class QuizDifficulty
{
    public const string Easy = "easy";
    public const string Medium = "medium";
    public const string Hard = "hard";

    /// <summary>
    /// Not a difficulty in its own right — a request for one to be chosen. The adaptive planner
    /// resolves it to easy/medium/hard from the learner's history, and only the resolved value is
    /// ever stored on a Quiz.
    /// </summary>
    public const string Adaptive = "adaptive";

    /// <summary>Maps arbitrary input to a known difficulty, defaulting to <see cref="Medium"/>.</summary>
    public static string Normalize(string difficulty) => difficulty.ToLowerInvariant() switch
    {
        Easy => Easy,
        Hard => Hard,
        _ => Medium
    };

    public static bool IsAdaptive(string difficulty)
        => string.Equals(difficulty, Adaptive, StringComparison.OrdinalIgnoreCase);
}
