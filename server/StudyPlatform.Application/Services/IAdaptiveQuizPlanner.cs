namespace StudyPlatform.Application.Services;

/// <summary>
/// What the next quiz should look like for one learner on one document: how hard, and what it should
/// dwell on.
/// </summary>
/// <param name="Difficulty">"beginner", "intermediate" or "advanced".</param>
/// <param name="FocusTopics">
/// Concepts the learner is demonstrably shaky on — questions they have missed, flashcards they keep
/// forgetting. Empty when there is no history to go on.
/// </param>
/// <param name="Rationale">One line the UI can show so the choice doesn't look arbitrary.</param>
public sealed record QuizPlan(string Difficulty, IReadOnlyList<string> FocusTopics, string Rationale);

/// <summary>
/// Chooses a quiz's difficulty and focus from what the learner has already shown, instead of asking
/// them to grade themselves with a dropdown. The signals are ones the platform already collects:
/// quiz accuracy, the mistake notebook, and FSRS memory state.
/// </summary>
public interface IAdaptiveQuizPlanner
{
    Task<QuizPlan> PlanAsync(Guid userId, Guid documentId, CancellationToken cancellationToken = default);
}
