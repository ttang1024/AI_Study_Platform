using StudyPlatform.Application.Common;
using StudyPlatform.Application.Services;
using StudyPlatform.Domain.Entities;
using StudyPlatform.Domain.Interfaces;

namespace StudyPlatform.Application.Practice;

/// <summary>
/// Turns a learner's history on one document into a difficulty and a focus list.
///
/// The scoring is deliberately a transparent heuristic rather than a model: it has to be explainable
/// to the learner ("you're at 91% here, so this one's harder"), and the inputs are sparse — a first
/// quiz has no history at all, and guessing hard from nothing is worse than starting in the middle.
/// </summary>
public class AdaptiveQuizPlanner : IAdaptiveQuizPlanner
{
    /// <summary>Accuracy at or above which the learner has outgrown the current level.</summary>
    private const double StrongAccuracy = 0.85;

    /// <summary>Accuracy at or below which harder questions would just compound the confusion.</summary>
    private const double WeakAccuracy = 0.55;

    /// <summary>Recent submissions to average over. Older attempts say more about who they were than who they are.</summary>
    private const int RecentSubmissions = 5;

    /// <summary>Open mistakes past which the learner is clearly still struggling, whatever the accuracy says.</summary>
    private const int StrugglingMistakeCount = 5;

    /// <summary>FSRS stability (days) below which a card is not yet retained.</summary>
    private const double FragileStabilityDays = 7;

    private const int MaxFocusTopics = 6;

    /// <summary>Focus topics are fed to the model in a prompt; full question text would swamp it.</summary>
    private const int MaxTopicChars = 120;

    private readonly IUnitOfWork _unitOfWork;

    public AdaptiveQuizPlanner(IUnitOfWork unitOfWork) => _unitOfWork = unitOfWork;

    public async Task<QuizPlan> PlanAsync(Guid userId, Guid documentId, CancellationToken cancellationToken = default)
    {
        var submissions = (await _unitOfWork.QuizSubmissions.FindAsNoTrackingAsync(
                s => s.UserId == userId && s.DocumentId == documentId, cancellationToken))
            .OrderByDescending(s => s.SubmittedAt)
            .Take(RecentSubmissions)
            .ToList();

        var openMistakes = (await _unitOfWork.MistakeEntries.FindAsNoTrackingAsync(
                m => m.UserId == userId && m.DocumentId == documentId && m.Status == "open", cancellationToken))
            .OrderByDescending(m => m.TimesMissed)
            .ThenByDescending(m => m.LastMissedAt)
            .ToList();

        var fragileCards = await GetFragileCardsAsync(userId, documentId, cancellationToken);

        var accuracy = Accuracy(submissions);
        var difficulty = ChooseDifficulty(accuracy, openMistakes.Count);
        var topics = FocusTopics(openMistakes, fragileCards);

        return new QuizPlan(difficulty, topics, Explain(accuracy, openMistakes.Count, fragileCards.Count, difficulty));
    }

    /// <summary>Null when the learner has never been quizzed on this document.</summary>
    private static double? Accuracy(IReadOnlyList<QuizSubmission> submissions)
    {
        var answered = submissions.Sum(s => s.Total);
        if (answered == 0)
            return null;

        return (double)submissions.Sum(s => s.Score) / answered;
    }

    private static string ChooseDifficulty(double? accuracy, int openMistakes)
    {
        // No history: start in the middle. Guessing from nothing is how you either bore someone or
        // bury them on their first attempt.
        if (accuracy == null)
            return QuizDifficulty.Medium;

        // A pile of unresolved mistakes outranks a flattering average — the average can be carried by
        // easy questions while the same handful keep going wrong.
        if (openMistakes >= StrugglingMistakeCount)
            return QuizDifficulty.Easy;

        if (accuracy >= StrongAccuracy)
            return QuizDifficulty.Hard;

        if (accuracy <= WeakAccuracy)
            return QuizDifficulty.Easy;

        return QuizDifficulty.Medium;
    }

    /// <summary>
    /// Cards the learner has seen but not retained: low FSRS stability, or a history of lapses. These
    /// are the concepts worth spending questions on.
    /// </summary>
    private async Task<List<Flashcard>> GetFragileCardsAsync(Guid userId, Guid documentId, CancellationToken cancellationToken)
    {
        var cards = (await _unitOfWork.Flashcards.GetByDocumentIdAsync(documentId, cancellationToken)).ToList();
        if (cards.Count == 0)
            return [];

        var cardIds = cards.Select(c => c.FlashcardId).ToHashSet();
        var srs = (await _unitOfWork.FlashcardSrs.FindAsNoTrackingAsync(
                s => s.UserId == userId, cancellationToken))
            .Where(s => cardIds.Contains(s.FlashcardId))
            .ToList();

        var fragileIds = srs
            // Reps == 0 means the card is new, not fragile: never seen is not the same as forgotten.
            .Where(s => s.Reps > 0 && (s.Stability < FragileStabilityDays || s.Lapses > 0))
            .OrderByDescending(s => s.Lapses)
            .ThenBy(s => s.Stability)
            .Select(s => s.FlashcardId)
            .ToList();

        var byId = cards.ToDictionary(c => c.FlashcardId);
        return fragileIds
            .Where(byId.ContainsKey)
            .Select(id => byId[id])
            .ToList();
    }

    /// <summary>
    /// Missed questions first — a question they got wrong is the sharpest evidence of a gap — then
    /// forgotten flashcards to fill out the list.
    /// </summary>
    private static List<string> FocusTopics(IReadOnlyList<MistakeEntry> mistakes, IReadOnlyList<Flashcard> fragileCards)
    {
        var topics = new List<string>();

        foreach (var mistake in mistakes)
        {
            if (topics.Count >= MaxFocusTopics) break;
            Add(mistake.Question);
        }

        foreach (var card in fragileCards)
        {
            if (topics.Count >= MaxFocusTopics) break;
            Add(card.Front);
        }

        return topics;

        void Add(string text)
        {
            var topic = Truncate(text);
            if (!string.IsNullOrWhiteSpace(topic) && !topics.Contains(topic, StringComparer.OrdinalIgnoreCase))
                topics.Add(topic);
        }
    }

    private static string Truncate(string text)
    {
        var clean = text.Replace('\n', ' ').Trim();
        return clean.Length <= MaxTopicChars ? clean : clean[..MaxTopicChars].TrimEnd() + "…";
    }

    private static string Explain(double? accuracy, int openMistakes, int fragileCards, string difficulty)
    {
        if (accuracy == null)
            return "First quiz on this material — starting at medium.";

        var parts = new List<string> { $"You're averaging {accuracy.Value:P0} on this material" };

        if (openMistakes > 0)
            parts.Add($"{openMistakes} unresolved mistake{(openMistakes == 1 ? "" : "s")}");

        if (fragileCards > 0)
            parts.Add($"{fragileCards} card{(fragileCards == 1 ? "" : "s")} you keep forgetting");

        return $"{string.Join(", with ", parts)} — this quiz is set to {difficulty}.";
    }
}
