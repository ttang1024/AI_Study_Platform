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

    private readonly IUnitOfWork _unitOfWork;
    private readonly IAppCache _cache;
    private readonly CacheOptions _cacheOptions;

    public GetCourseMasteryQueryHandler(IUnitOfWork unitOfWork, IAppCache cache, IOptions<CacheOptions> cacheOptions)
    {
        _unitOfWork = unitOfWork;
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
        var courses = (await _unitOfWork.Courses.GetByUserIdAsync(userId, ct)).ToList();
        if (courses.Count == 0)
            return Array.Empty<CourseMasteryDto>();

        // Build document/video -> course maps so any content type can be attributed to a course.
        var docToCourse = new Dictionary<Guid, Guid>();
        foreach (var course in courses)
        {
            var docs = await _unitOfWork.Documents.GetByCourseIdAsync(course.CourseId, userId, ct);
            foreach (var doc in docs)
                docToCourse[doc.DocumentId] = course.CourseId;
        }

        var (videos, _) = await _unitOfWork.Videos.GetPagedAsync(userId, null, null, 1, int.MaxValue, ct);
        var videoToCourse = videos.ToDictionary(v => v.VideoId, v => v.CourseId);

        Guid? CourseOf(Guid? docId, Guid? videoId)
        {
            if (docId.HasValue && docToCourse.TryGetValue(docId.Value, out var c1)) return c1;
            if (videoId.HasValue && videoToCourse.TryGetValue(videoId.Value, out var c2)) return c2;
            return null;
        }

        // Flashcards + FSRS state.
        var flashcards = await _unitOfWork.Flashcards.GetByUserIdAsync(userId, ct);
        var srs = await _unitOfWork.FlashcardSrs.GetByUserIdAsync(userId, ct);
        var srsState = srs.ToDictionary(s => s.FlashcardId, s => s.State);

        // Glossary terms + mastered set.
        var glossaryTerms = await _unitOfWork.GlossaryTerms.GetByUserWithSourcesAsync(userId, ct);
        var masteredTerms = (await _unitOfWork.GlossaryMastered.GetMasteredTermIdsByUserAsync(userId, ct)).ToHashSet();

        // Quiz submissions.
        var submissions = await _unitOfWork.QuizSubmissions.GetAllByUserAsync(userId, ct);

        // Worked problems + mastered set.
        var problems = await _unitOfWork.WorkedProblems.GetByUserAsync(userId, null, null, ct);
        var masteredProblems = (await _unitOfWork.WorkedProblemMastered.GetMasteredProblemIdsByUserAsync(userId, ct)).ToHashSet();

        var dtos = new List<CourseMasteryDto>(courses.Count);
        foreach (var course in courses)
        {
            var components = new List<CourseMasteryComponentDto>();

            var courseCards = flashcards.Where(f => CourseOf(f.DocumentId, f.VideoId) == course.CourseId).ToList();
            if (courseCards.Count > 0)
            {
                var reviewed = courseCards.Count(f => srsState.TryGetValue(f.FlashcardId, out var st) && st >= FsrsReviewState);
                components.Add(new CourseMasteryComponentDto("Flashcards", Pct(reviewed, courseCards.Count), courseCards.Count));
            }

            var courseTerms = glossaryTerms.Where(t => CourseOf(t.DocumentId, t.VideoId) == course.CourseId).ToList();
            if (courseTerms.Count > 0)
            {
                var mastered = courseTerms.Count(t => masteredTerms.Contains(t.GlossaryTermId));
                components.Add(new CourseMasteryComponentDto("Glossary", Pct(mastered, courseTerms.Count), courseTerms.Count));
            }

            var courseSubs = submissions.Where(s => CourseOf(s.DocumentId, s.VideoId) == course.CourseId).ToList();
            var totalQuestions = courseSubs.Sum(s => s.Total);
            if (totalQuestions > 0)
            {
                var correct = courseSubs.Sum(s => s.Score);
                components.Add(new CourseMasteryComponentDto("Quizzes", Pct(correct, totalQuestions), totalQuestions));
            }

            var courseProblems = problems.Where(p => CourseOf(p.DocumentId, p.VideoId) == course.CourseId).ToList();
            if (courseProblems.Count > 0)
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

    private static double Pct(int part, int whole) => whole > 0 ? Math.Round((double)part / whole * 100, 1) : 0;
}
