using System.Text.Json;
using System.Text.RegularExpressions;
using MediatR;
using StudyPlatform.Application.Analytics.Queries;
using StudyPlatform.Application.Common;
using StudyPlatform.Application.Flashcards.Commands;
using StudyPlatform.Application.Services;
using StudyPlatform.Domain.Entities;
using StudyPlatform.Domain.Interfaces;

namespace StudyPlatform.Application.Practice.Queries;

// ── DTOs ──────────────────────────────────────────────────────────────────────

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

// ── Generate ──────────────────────────────────────────────────────────────────

/// <summary>
/// Assembles a timed, mixed-source practice test by sampling the user's quiz bank, flashcards,
/// glossary terms, and worked problems. Pure read — nothing is persisted until results come back
/// via <see cref="SubmitPracticeTestCommand"/>.
/// </summary>
public record GeneratePracticeTestQuery(
    Guid UserId, int Count, Guid? CourseId, IReadOnlyCollection<string> Sources) : IRequest<Result<PracticeTestDto>>;

public class GeneratePracticeTestQueryHandler : IRequestHandler<GeneratePracticeTestQuery, Result<PracticeTestDto>>
{
    private static readonly string[] AllSources = { "quiz", "flashcard", "glossary", "problem" };
    private const int MaxCount = 50;

    private readonly IUnitOfWork _unitOfWork;

    public GeneratePracticeTestQueryHandler(IUnitOfWork unitOfWork)
    {
        _unitOfWork = unitOfWork;
    }

    public async Task<Result<PracticeTestDto>> Handle(GeneratePracticeTestQuery request, CancellationToken ct)
    {
        var userId = request.UserId;
        var count = Math.Clamp(request.Count, 1, MaxCount);
        var sources = (request.Sources.Count > 0 ? request.Sources : AllSources)
            .Select(s => s.Trim().ToLowerInvariant())
            .ToHashSet();

        // Course mapping so we can filter any source down to a single course.
        var documents = (await _unitOfWork.Documents.FindAsync(d => d.UserId == userId, ct)).ToList();
        var videos = (await _unitOfWork.Videos.FindAsync(v => v.UserId == userId, ct)).ToList();
        var docToCourse = documents.ToDictionary(d => d.DocumentId, d => d.CourseId);
        var videoToCourse = videos.ToDictionary(v => v.VideoId, v => v.CourseId);

        Guid? CourseOf(Guid? docId, Guid? videoId)
        {
            if (docId.HasValue && docToCourse.TryGetValue(docId.Value, out var c1)) return c1;
            if (videoId.HasValue && videoToCourse.TryGetValue(videoId.Value, out var c2)) return c2;
            return null;
        }

        bool CourseMatches(Guid? courseId) => !request.CourseId.HasValue || courseId == request.CourseId;

        var pools = new Dictionary<string, List<PracticeQuestionDto>>();

        // ── Quiz bank (multiple choice, auto-graded) ──
        if (sources.Contains("quiz"))
        {
            var quizzes = (await _unitOfWork.Quizzes.FindAsync(q => q.UserId == userId, ct)).ToList();
            var pool = new List<PracticeQuestionDto>();
            foreach (var q in quizzes)
            {
                var courseId = CourseOf(q.DocumentId, q.VideoId);
                if (!CourseMatches(courseId)) continue;
                var options = DeserializeOptions(q.OptionsJson);
                if (options.Length < 2) continue;
                var answer = ResolveCorrectOption(options, q.CorrectAnswer);
                pool.Add(new PracticeQuestionDto(
                    $"quiz:{q.QuizId}", "quiz", q.QuizId.ToString(), "mc", q.Question,
                    options, answer, NullIfBlank(q.Explanation), q.Difficulty, courseId?.ToString()));
            }
            pools["quiz"] = pool;
        }

        // ── Flashcards (recall, self-graded; cloze fronts get blanked out) ──
        if (sources.Contains("flashcard"))
        {
            var cards = (await _unitOfWork.Flashcards.GetByUserIdAsync(userId, ct)).ToList();
            pools["flashcard"] = cards
                .Select(f => new
                {
                    f,
                    courseId = CourseOf(f.DocumentId, f.VideoId),
                    qa = string.IsNullOrWhiteSpace(f.Front) ? null : PracticeFlashcardFormat.ToPromptAnswer(f.Front, f.Back),
                })
                .Where(x => CourseMatches(x.courseId) && x.qa is not null)
                .Select(x => new PracticeQuestionDto(
                    $"flashcard:{x.f.FlashcardId}", "flashcard", x.f.FlashcardId.ToString(), "recall",
                    x.qa!.Value.Prompt, null, x.qa.Value.Answer, null, x.f.Difficulty, x.courseId?.ToString()))
                .ToList();
        }

        // ── Glossary (term → definition; multiple choice when enough distractors exist) ──
        if (sources.Contains("glossary"))
        {
            var terms = (await _unitOfWork.GlossaryTerms.GetByUserWithSourcesAsync(userId, ct)).ToList();
            var allDefinitions = terms.Select(t => t.Definition).Where(d => !string.IsNullOrWhiteSpace(d)).Distinct().ToList();
            var pool = new List<PracticeQuestionDto>();
            foreach (var t in terms)
            {
                var courseId = CourseOf(t.DocumentId, t.VideoId);
                if (!CourseMatches(courseId) || string.IsNullOrWhiteSpace(t.Term) || string.IsNullOrWhiteSpace(t.Definition))
                    continue;

                var distractors = allDefinitions
                    .Where(d => !string.Equals(d, t.Definition, StringComparison.OrdinalIgnoreCase))
                    .OrderBy(_ => Random.Shared.Next())
                    .Take(3)
                    .ToList();

                if (distractors.Count == 3)
                {
                    var options = distractors.Append(t.Definition).OrderBy(_ => Random.Shared.Next()).ToArray();
                    pool.Add(new PracticeQuestionDto(
                        $"glossary:{t.GlossaryTermId}", "glossary", t.GlossaryTermId.ToString(), "mc",
                        $"What does “{t.Term}” mean?", options, t.Definition, null, "medium", courseId?.ToString()));
                }
                else
                {
                    pool.Add(new PracticeQuestionDto(
                        $"glossary:{t.GlossaryTermId}", "glossary", t.GlossaryTermId.ToString(), "recall",
                        $"Define: {t.Term}", null, t.Definition, null, "medium", courseId?.ToString()));
                }
            }
            pools["glossary"] = pool;
        }

        // ── Worked problems (recall, self-graded) ──
        if (sources.Contains("problem"))
        {
            var problems = (await _unitOfWork.WorkedProblems.GetByUserAsync(userId, null, null, ct)).ToList();
            pools["problem"] = problems
                .Select(p => new { p, courseId = CourseOf(p.DocumentId, p.VideoId) })
                .Where(x => CourseMatches(x.courseId) && !string.IsNullOrWhiteSpace(x.p.ProblemText))
                .Select(x => new PracticeQuestionDto(
                    $"problem:{x.p.WorkedProblemId}", "problem", x.p.WorkedProblemId.ToString(), "recall",
                    x.p.ProblemText, null, x.p.FinalAnswer, BuildSteps(x.p.StepsJson), x.p.Difficulty, x.courseId?.ToString()))
                .ToList();
        }

        // Shuffle each pool, then round-robin so the test is balanced across the chosen sources.
        foreach (var pool in pools.Values)
            Shuffle(pool);

        var selected = RoundRobin(pools.Values, count);
        Shuffle(selected); // mix the sources so it doesn't go quiz-block then flashcard-block

        return Result<PracticeTestDto>.Success(new PracticeTestDto(selected, selected.Count, DateTime.UtcNow));
    }

    private static List<PracticeQuestionDto> RoundRobin(IEnumerable<List<PracticeQuestionDto>> pools, int count)
    {
        var queues = pools.Where(p => p.Count > 0).Select(p => new Queue<PracticeQuestionDto>(p)).ToList();
        var result = new List<PracticeQuestionDto>(count);
        while (result.Count < count && queues.Any(q => q.Count > 0))
        {
            foreach (var q in queues)
            {
                if (result.Count >= count) break;
                if (q.Count > 0) result.Add(q.Dequeue());
            }
        }
        return result;
    }

    private static void Shuffle<T>(IList<T> list)
    {
        for (var i = list.Count - 1; i > 0; i--)
        {
            var j = Random.Shared.Next(i + 1);
            (list[i], list[j]) = (list[j], list[i]);
        }
    }

    private static string[] DeserializeOptions(string optionsJson)
    {
        if (string.IsNullOrWhiteSpace(optionsJson)) return Array.Empty<string>();
        try { return JsonSerializer.Deserialize<string[]>(optionsJson) ?? Array.Empty<string>(); }
        catch (JsonException) { return Array.Empty<string>(); }
    }

    /// <summary>Map a stored correct answer (full text, "A", or "A) text") onto the matching option text.</summary>
    private static string ResolveCorrectOption(string[] options, string correct)
    {
        var trimmed = (correct ?? string.Empty).Trim();
        if (options.Length == 0) return trimmed;

        var exact = options.FirstOrDefault(o => string.Equals(o.Trim(), trimmed, StringComparison.OrdinalIgnoreCase));
        if (exact != null) return exact;

        if (trimmed.Length >= 1 && char.IsLetter(trimmed[0]))
        {
            var idx = char.ToUpperInvariant(trimmed[0]) - 'A';
            if (idx >= 0 && idx < options.Length) return options[idx];
        }
        return trimmed;
    }

    private static string? BuildSteps(string stepsJson)
    {
        if (string.IsNullOrWhiteSpace(stepsJson)) return null;
        try
        {
            var steps = JsonSerializer.Deserialize<string[]>(stepsJson);
            return steps is { Length: > 0 } ? string.Join("\n", steps) : null;
        }
        catch (JsonException) { return null; }
    }

    private static string? NullIfBlank(string? s) => string.IsNullOrWhiteSpace(s) ? null : s;
}

// ── Submit ────────────────────────────────────────────────────────────────────

/// <summary>
/// Records practice-test results, feeding every mastery signal the platform already tracks:
/// quiz attempts (accuracy analytics), FSRS reviews for flashcards, and the mastered flags for
/// glossary terms / worked problems answered correctly. No new tables — it reuses existing paths.
/// </summary>
public record SubmitPracticeTestCommand(Guid UserId, IReadOnlyList<PracticeResultItem> Results)
    : IRequest<Result<PracticeTestSummaryDto>>;

public class SubmitPracticeTestCommandHandler : IRequestHandler<SubmitPracticeTestCommand, Result<PracticeTestSummaryDto>>
{
    private const int RatingGood = 3;
    private const int RatingAgain = 1;

    private readonly IUnitOfWork _unitOfWork;
    private readonly IMediator _mediator;
    private readonly IAppCache _cache;

    public SubmitPracticeTestCommandHandler(IUnitOfWork unitOfWork, IMediator mediator, IAppCache cache)
    {
        _unitOfWork = unitOfWork;
        _mediator = mediator;
        _cache = cache;
    }

    public async Task<Result<PracticeTestSummaryDto>> Handle(SubmitPracticeTestCommand request, CancellationToken ct)
    {
        var results = request.Results ?? Array.Empty<PracticeResultItem>();
        var userId = request.UserId;

        var masteredTerms = (await _unitOfWork.GlossaryMastered.GetMasteredTermIdsByUserAsync(userId, ct)).ToHashSet();
        var masteredProblems = (await _unitOfWork.WorkedProblemMastered.GetMasteredProblemIdsByUserAsync(userId, ct)).ToHashSet();

        foreach (var item in results)
        {
            switch (item.Source)
            {
                case "quiz":
                    await _mediator.Send(new RecordQuizAttemptCommand(userId, item.SourceId, item.IsCorrect), ct);
                    break;

                case "flashcard":
                    await _mediator.Send(new ReviewFlashcardCommand(item.SourceId, userId, item.IsCorrect ? RatingGood : RatingAgain), ct);
                    break;

                case "glossary":
                    if (item.IsCorrect && masteredTerms.Add(item.SourceId))
                        await _unitOfWork.GlossaryMastered.AddAsync(
                            new GlossaryMastered { Id = Guid.NewGuid(), UserId = userId, GlossaryTermId = item.SourceId, MasteredAt = DateTime.UtcNow }, ct);
                    break;

                case "problem":
                    if (item.IsCorrect && masteredProblems.Add(item.SourceId))
                        await _unitOfWork.WorkedProblemMastered.AddAsync(
                            new WorkedProblemMastered { Id = Guid.NewGuid(), UserId = userId, WorkedProblemId = item.SourceId, MasteredAt = DateTime.UtcNow }, ct);
                    break;

                case "mistake":
                    // Smart-session redo of a mistake-notebook entry: a correct answer
                    // resolves it, a wrong one bumps its missed counter.
                    var mistake = (await _unitOfWork.MistakeEntries.FindAsync(
                        m => m.MistakeEntryId == item.SourceId && m.UserId == userId, ct)).FirstOrDefault();
                    if (mistake is null) break;
                    if (item.IsCorrect)
                    {
                        mistake.Status = "resolved";
                        mistake.ResolvedAt = DateTime.UtcNow;
                    }
                    else
                    {
                        mistake.TimesMissed++;
                        mistake.LastMissedAt = DateTime.UtcNow;
                    }
                    break;
            }
        }

        await _unitOfWork.SaveChangesAsync(ct);

        // Mastery signals changed — drop the cached summaries so the dashboard/today plan refresh.
        await _cache.RemoveAsync(DashboardSummaryCache.Key(userId), ct);
        await _cache.RemoveAsync($"recommendations:user:{userId}", ct);

        var total = results.Count;
        var correct = results.Count(r => r.IsCorrect);
        var accuracy = total > 0 ? Math.Round(correct * 100.0 / total, 1) : 0;
        return Result<PracticeTestSummaryDto>.Success(new PracticeTestSummaryDto(total, correct, accuracy));
    }
}
