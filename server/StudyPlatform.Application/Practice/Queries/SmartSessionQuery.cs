using System.Text.Json;
using MediatR;
using StudyPlatform.Application.Common;
using StudyPlatform.Domain.Interfaces;

namespace StudyPlatform.Application.Practice.Queries;

/// <summary>
/// The "daily smart session": one button that composes a short, prioritized, interleaved
/// review from the three highest-leverage pools the platform already tracks —
/// FSRS flashcards due today, open mistake-notebook entries, and unmastered glossary
/// terms. Returns the same <see cref="PracticeTestDto"/> the practice player runs, and
/// results flow back through <see cref="SubmitPracticeTestCommand"/> (which feeds FSRS,
/// quiz-accuracy analytics, mistake resolution, and mastery flags).
/// </summary>
public record GetSmartSessionQuery(Guid UserId) : IRequest<Result<PracticeTestDto>>;

public class GetSmartSessionQueryHandler : IRequestHandler<GetSmartSessionQuery, Result<PracticeTestDto>>
{
    private const int MaxDueCards = 10;
    private const int MaxMistakes = 5;
    private const int MaxWeakTerms = 5;

    private readonly IUnitOfWork _unitOfWork;

    public GetSmartSessionQueryHandler(IUnitOfWork unitOfWork)
    {
        _unitOfWork = unitOfWork;
    }

    public async Task<Result<PracticeTestDto>> Handle(GetSmartSessionQuery request, CancellationToken ct)
    {
        var userId = request.UserId;

        var documents = (await _unitOfWork.Documents.FindAsync(d => d.UserId == userId, ct)).ToList();
        var videos = (await _unitOfWork.Videos.FindAsync(v => v.UserId == userId, ct)).ToList();
        var docToCourse = documents.ToDictionary(d => d.DocumentId, d => d.CourseId);
        var videoToCourse = videos.ToDictionary(v => v.VideoId, v => v.CourseId);

        string? CourseOf(Guid? docId, Guid? videoId)
        {
            if (docId.HasValue && docToCourse.TryGetValue(docId.Value, out var c1)) return c1.ToString();
            if (videoId.HasValue && videoToCourse.TryGetValue(videoId.Value, out var c2)) return c2.ToString();
            return null;
        }

        // ── 1. FSRS flashcards due now (most overdue first) ──
        var due = (await _unitOfWork.FlashcardSrs.GetDueByUserIdAsync(userId, DateTime.UtcNow, ct))
            .OrderBy(s => s.Due)
            .Take(MaxDueCards)
            .ToList();
        var dueCards = new List<PracticeQuestionDto>();
        if (due.Count > 0)
        {
            var cards = (await _unitOfWork.Flashcards.GetByUserIdAsync(userId, ct))
                .ToDictionary(f => f.FlashcardId);
            foreach (var srs in due)
            {
                if (!cards.TryGetValue(srs.FlashcardId, out var card) || string.IsNullOrWhiteSpace(card.Front))
                    continue;
                // Cloze fronts get blanked; cards with nothing to reveal are skipped.
                var qa = PracticeFlashcardFormat.ToPromptAnswer(card.Front, card.Back);
                if (qa is null) continue;
                dueCards.Add(new PracticeQuestionDto(
                    $"flashcard:{card.FlashcardId}", "flashcard", card.FlashcardId.ToString(), "recall",
                    qa.Value.Prompt, null, qa.Value.Answer, null, card.Difficulty,
                    CourseOf(card.DocumentId, card.VideoId)));
            }
        }

        // ── 2. Open mistakes (most-missed first) ──
        var mistakes = (await _unitOfWork.MistakeEntries.FindAsync(
                m => m.UserId == userId && m.Status == "open", ct))
            .OrderByDescending(m => m.TimesMissed)
            .ThenByDescending(m => m.LastMissedAt)
            .Take(MaxMistakes)
            .Select(m =>
            {
                var options = DeserializeOptions(m.OptionsJson);
                var isMc = options.Length >= 2;
                return new PracticeQuestionDto(
                    $"mistake:{m.MistakeEntryId}", "mistake", m.MistakeEntryId.ToString(),
                    isMc ? "mc" : "recall", m.Question,
                    isMc ? options : null, m.CorrectAnswer,
                    string.IsNullOrWhiteSpace(m.Explanation) ? null : m.Explanation,
                    "hard", CourseOf(m.DocumentId, m.VideoId));
            })
            .ToList();

        // ── 3. Unmastered glossary terms (weak concepts) ──
        var masteredTerms = (await _unitOfWork.GlossaryMastered.GetMasteredTermIdsByUserAsync(userId, ct)).ToHashSet();
        var allTerms = (await _unitOfWork.GlossaryTerms.GetByUserWithSourcesAsync(userId, ct))
            .Where(t => !masteredTerms.Contains(t.GlossaryTermId)
                && !string.IsNullOrWhiteSpace(t.Term)
                && !string.IsNullOrWhiteSpace(t.Definition))
            .ToList();
        var allDefinitions = allTerms.Select(t => t.Definition).Distinct().ToList();
        var weakTerms = allTerms
            .OrderBy(_ => Random.Shared.Next())
            .Take(MaxWeakTerms)
            .Select(t =>
            {
                var distractors = allDefinitions
                    .Where(d => !string.Equals(d, t.Definition, StringComparison.OrdinalIgnoreCase))
                    .OrderBy(_ => Random.Shared.Next())
                    .Take(3)
                    .ToList();
                var courseId = CourseOf(t.DocumentId, t.VideoId);
                if (distractors.Count == 3)
                {
                    var options = distractors.Append(t.Definition).OrderBy(_ => Random.Shared.Next()).ToArray();
                    return new PracticeQuestionDto(
                        $"glossary:{t.GlossaryTermId}", "glossary", t.GlossaryTermId.ToString(), "mc",
                        $"What does “{t.Term}” mean?", options, t.Definition, null, "medium", courseId);
                }
                return new PracticeQuestionDto(
                    $"glossary:{t.GlossaryTermId}", "glossary", t.GlossaryTermId.ToString(), "recall",
                    $"Define: {t.Term}", null, t.Definition, null, "medium", courseId);
            })
            .ToList();

        // Interleave the pools so due reviews, redos, and weak concepts alternate
        // instead of arriving in blocks.
        var pools = new[] { dueCards, mistakes, weakTerms };
        var session = new List<PracticeQuestionDto>();
        var queues = pools.Where(p => p.Count > 0).Select(p => new Queue<PracticeQuestionDto>(p)).ToList();
        while (queues.Any(q => q.Count > 0))
        {
            foreach (var q in queues)
                if (q.Count > 0) session.Add(q.Dequeue());
        }

        return Result<PracticeTestDto>.Success(new PracticeTestDto(session, session.Count, DateTime.UtcNow));
    }

    private static string[] DeserializeOptions(string optionsJson)
    {
        if (string.IsNullOrWhiteSpace(optionsJson)) return Array.Empty<string>();
        try { return JsonSerializer.Deserialize<string[]>(optionsJson) ?? Array.Empty<string>(); }
        catch (JsonException) { return Array.Empty<string>(); }
    }
}
