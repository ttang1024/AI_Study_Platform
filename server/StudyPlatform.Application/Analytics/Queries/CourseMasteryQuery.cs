using MediatR;
using Microsoft.Extensions.Options;
using StudyPlatform.Application.Analytics.DTOs;
using StudyPlatform.Application.Common;
using StudyPlatform.Application.Services;
using StudyPlatform.Application.Settings;
using StudyPlatform.Domain.Interfaces;

namespace StudyPlatform.Application.Analytics.Queries;

/// <summary>
/// Computes a 0-100 "topic mastery" score per course by blending the signals we already
/// collect: flashcard retention (FSRS state), glossary terms mastered, quiz accuracy, and
/// worked-problem mastery. Each course's score is the mean of whichever signals have data.
/// </summary>
public record GetCourseMasteryQuery(Guid UserId) : IRequest<Result<IEnumerable<CourseMasteryDto>>>;

public class GetCourseMasteryQueryHandler : IRequestHandler<GetCourseMasteryQuery, Result<IEnumerable<CourseMasteryDto>>>
{
    // FSRS state 2 == Review: the card has graduated out of learning/relearning.
    private const int FsrsReviewState = 2;

    private readonly ICourseRepository _courses;
    private readonly IDocumentRepository _documents;
    private readonly IFlashcardRepository _flashcards;
    private readonly IQuizSubmissionRepository _quizSubmissions;
    private readonly IVideoRepository _videos;
    private readonly IGlossaryTermRepository _glossaryTerms;
    private readonly IGlossaryMasteredRepository _glossaryMastered;
    private readonly IWorkedProblemRepository _workedProblems;
    private readonly IWorkedProblemMasteredRepository _workedProblemMastered;
    private readonly IFlashcardSrsDataRepository _flashcardSrs;
    private readonly IAppCache _cache;
    private readonly CacheOptions _cacheOptions;

    public GetCourseMasteryQueryHandler(ICourseRepository courses, IDocumentRepository documents, IFlashcardRepository flashcards, IQuizSubmissionRepository quizSubmissions, IVideoRepository videos, IGlossaryTermRepository glossaryTerms, IGlossaryMasteredRepository glossaryMastered, IWorkedProblemRepository workedProblems, IWorkedProblemMasteredRepository workedProblemMastered, IFlashcardSrsDataRepository flashcardSrs, IAppCache cache, IOptions<CacheOptions> cacheOptions)
    {
        _courses = courses;
        _documents = documents;
        _flashcards = flashcards;
        _quizSubmissions = quizSubmissions;
        _videos = videos;
        _glossaryTerms = glossaryTerms;
        _glossaryMastered = glossaryMastered;
        _workedProblems = workedProblems;
        _workedProblemMastered = workedProblemMastered;
        _flashcardSrs = flashcardSrs;
        _cache = cache;
        _cacheOptions = cacheOptions.Value;
    }

    public async Task<Result<IEnumerable<CourseMasteryDto>>> Handle(GetCourseMasteryQuery request, CancellationToken cancellationToken)
    {
        var cacheKey = $"analytics:course-mastery:user:{request.UserId}";
        var result = await _cache.GetOrCreateAsync(
            cacheKey,
            ct => ComputeAsync(request.UserId, ct),
            TimeSpan.FromSeconds(_cacheOptions.AnalyticsSummarySeconds),
            cancellationToken);

        return Result<IEnumerable<CourseMasteryDto>>.Success(result);
    }

    private async Task<CourseMasteryDto[]> ComputeAsync(Guid userId, CancellationToken ct)
    {
        var courses = (await _courses.GetListItemsByUserAsync(userId, ct)).ToList();
        if (courses.Count == 0)
            return Array.Empty<CourseMasteryDto>();

        // Attribution maps, one projected query each. Neither pulls the rows themselves: documents carry
        // their extracted text and videos their transcripts, and all we want here is the course id.
        var docToCourse = await _documents.GetDocumentCourseMapAsync(userId, ct);
        var videoToCourse = await _videos.GetVideoCourseMapAsync(userId, ct);

        Guid? CourseOf(Guid? docId, Guid? videoId)
        {
            if (docId.HasValue && docToCourse.TryGetValue(docId.Value, out var c1)) return c1;
            if (videoId.HasValue && videoToCourse.TryGetValue(videoId.Value, out var c2)) return c2;
            return null;
        }

        // Flashcards + FSRS state.
        var flashcards = await _flashcards.GetByUserIdAsync(userId, ct);
        var srs = await _flashcardSrs.GetByUserIdAsync(userId, ct);
        var srsState = srs.ToDictionary(s => s.FlashcardId, s => s.State);

        // Glossary terms + mastered set.
        var glossaryTerms = await _glossaryTerms.GetByUserWithSourcesAsync(userId, ct);
        var masteredTerms = (await _glossaryMastered.GetMasteredTermIdsByUserAsync(userId, ct)).ToHashSet();

        // Quiz submissions.
        var submissions = await _quizSubmissions.GetAllByUserAsync(userId, ct);

        // Worked problems + mastered set.
        var problems = await _workedProblems.GetByUserAsync(userId, null, null, ct);
        var masteredProblems = (await _workedProblemMastered.GetMasteredProblemIdsByUserAsync(userId, ct)).ToHashSet();

        // Bucket each artifact by course once. Filtering the four lists inside the course loop instead
        // would rescan every artifact the user owns once per course.
        var cardsByCourse = GroupByCourse(flashcards, f => CourseOf(f.DocumentId, f.VideoId));
        var termsByCourse = GroupByCourse(glossaryTerms, t => CourseOf(t.DocumentId, t.VideoId));
        var subsByCourse = GroupByCourse(submissions, s => CourseOf(s.DocumentId, s.VideoId));
        var problemsByCourse = GroupByCourse(problems, p => CourseOf(p.DocumentId, p.VideoId));

        var dtos = new List<CourseMasteryDto>(courses.Count);
        foreach (var course in courses)
        {
            var components = new List<CourseMasteryComponentDto>();

            var courseCards = cardsByCourse.GetValueOrDefault(course.CourseId);
            if (courseCards is { Count: > 0 })
            {
                var reviewed = courseCards.Count(f => srsState.TryGetValue(f.FlashcardId, out var st) && st >= FsrsReviewState);
                components.Add(new CourseMasteryComponentDto("Flashcards", Pct(reviewed, courseCards.Count), courseCards.Count));
            }

            var courseTerms = termsByCourse.GetValueOrDefault(course.CourseId);
            if (courseTerms is { Count: > 0 })
            {
                var mastered = courseTerms.Count(t => masteredTerms.Contains(t.GlossaryTermId));
                components.Add(new CourseMasteryComponentDto("Glossary", Pct(mastered, courseTerms.Count), courseTerms.Count));
            }

            var courseSubs = subsByCourse.GetValueOrDefault(course.CourseId);
            var totalQuestions = courseSubs?.Sum(s => s.Total) ?? 0;
            if (totalQuestions > 0)
            {
                var correct = courseSubs!.Sum(s => s.Score);
                components.Add(new CourseMasteryComponentDto("Quizzes", Pct(correct, totalQuestions), totalQuestions));
            }

            var courseProblems = problemsByCourse.GetValueOrDefault(course.CourseId);
            if (courseProblems is { Count: > 0 })
            {
                var mastered = courseProblems.Count(p => masteredProblems.Contains(p.WorkedProblemId));
                components.Add(new CourseMasteryComponentDto("Problems", Pct(mastered, courseProblems.Count), courseProblems.Count));
            }

            var score = components.Count > 0 ? Math.Round(components.Average(c => c.Score), 1) : 0;
            dtos.Add(new CourseMasteryDto(course.CourseId, course.CourseName, course.CourseColor, score, components));
        }

        return dtos
            .OrderByDescending(d => d.Components.Any())
            .ThenByDescending(d => d.MasteryScore)
            .ToArray();
    }

    /// <summary>Buckets artifacts by the course they resolve to, dropping the ones that resolve to none.</summary>
    private static Dictionary<Guid, List<T>> GroupByCourse<T>(IEnumerable<T> items, Func<T, Guid?> courseOf)
    {
        var buckets = new Dictionary<Guid, List<T>>();
        foreach (var item in items)
        {
            if (courseOf(item) is not { } courseId)
                continue;
            if (!buckets.TryGetValue(courseId, out var bucket))
                buckets[courseId] = bucket = [];
            bucket.Add(item);
        }
        return buckets;
    }

    private static double Pct(int part, int whole) => whole > 0 ? Math.Round((double)part / whole * 100, 1) : 0;
}
