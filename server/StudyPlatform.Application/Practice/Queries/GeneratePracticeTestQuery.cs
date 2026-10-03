using System.Text.Json;
using MediatR;
using StudyPlatform.Application.Common;
using StudyPlatform.Domain.Interfaces;

namespace StudyPlatform.Application.Practice.Queries;

/// <summary>
/// Assembles a timed, mixed-source practice test by sampling the user's quiz bank, flashcards,
/// glossary terms, and worked problems. Pure read — nothing is persisted until results come back
/// via <see cref="SubmitPracticeTestCommand"/>.
/// </summary>
/// <param name="CourseId">Restrict the test to one course. Null draws from the whole library.</param>
/// <param name="InterleaveCourses">
/// Rotate across courses so consecutive questions come from different ones, instead of shuffling.
/// Interleaved practice is harder and slower in the moment but retains better, because the learner has
/// to identify which approach a question needs rather than coasting on one course's context. Ignored
/// when <paramref name="CourseId"/> pins the test to a single course — there is nothing to interleave.
/// </param>
public record GeneratePracticeTestQuery(
    Guid UserId,
    int Count,
    Guid? CourseId,
    IReadOnlyCollection<string> Sources,
    bool InterleaveCourses = false) : IRequest<Result<PracticeTestDto>>;

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
        var documents = (await _unitOfWork.Documents.FindAsNoTrackingAsync(d => d.UserId == userId, ct)).ToList();
        var videos = (await _unitOfWork.Videos.FindAsNoTrackingAsync(v => v.UserId == userId, ct)).ToList();
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
            var quizzes = (await _unitOfWork.Quizzes.FindAsNoTrackingAsync(q => q.UserId == userId, ct)).ToList();
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

        if (request.InterleaveCourses && !request.CourseId.HasValue)
        {
            // Rotate across courses rather than shuffling. A shuffle only mixes courses on average and
            // will happily deal three consecutive questions from the same one; rotating guarantees the
            // switch, which is the property interleaved practice actually depends on.
            selected = InterleaveByCourse(selected);
        }
        else
        {
            Shuffle(selected); // mix the sources so it doesn't go quiz-block then flashcard-block
        }

        return Result<PracticeTestDto>.Success(new PracticeTestDto(selected, selected.Count, DateTime.UtcNow));
    }

    /// <summary>
    /// Reorders a selection so consecutive questions come from different courses wherever the pool
    /// allows. Questions with no course (an artifact we could not attribute) are bucketed together and
    /// rotated like any other group rather than dropped.
    /// </summary>
    private static List<PracticeQuestionDto> InterleaveByCourse(List<PracticeQuestionDto> questions)
    {
        var byCourse = questions
            .GroupBy(q => q.CourseId ?? string.Empty)
            .Select(group =>
            {
                var bucket = group.ToList();
                Shuffle(bucket); // vary the order within a course between sessions
                return bucket;
            })
            // Largest course first: it gets dealt on every rotation, so its questions spread across the
            // whole session instead of clumping at the end once the smaller courses run dry.
            .OrderByDescending(bucket => bucket.Count)
            .ToList();

        return RoundRobin(byCourse, questions.Count);
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
