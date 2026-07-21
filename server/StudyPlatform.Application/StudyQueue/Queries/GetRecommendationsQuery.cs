using MediatR;
using Microsoft.Extensions.Options;
using StudyPlatform.Application.Analytics.DTOs;
using StudyPlatform.Application.Analytics.Queries;
using StudyPlatform.Application.Common;
using StudyPlatform.Application.Services;
using StudyPlatform.Application.Settings;
using StudyPlatform.Application.StudyQueue.DTOs;
using StudyPlatform.Domain.Interfaces;
using StudyPlatform.Domain.Projections;

namespace StudyPlatform.Application.StudyQueue.Queries;

/// <summary>
/// Heuristic recommendation engine. Blends the signals we already collect — FSRS due
/// cards, low-scoring quizzes, unmastered glossary terms / worked problems, and per-course
/// mastery — into a ranked review queue plus "next best content" suggestions. No LLM call.
/// </summary>
public record GetRecommendationsQuery(Guid UserId) : IRequest<Result<RecommendationsDto>>;

public class GetRecommendationsQueryHandler : IRequestHandler<GetRecommendationsQuery, Result<RecommendationsDto>>
{
    private const double LowAccuracyThreshold = 70;
    private const double LowMasteryThreshold = 60;
    private const int MaxPerSection = 8;

    private readonly IUnitOfWork _unitOfWork;
    private readonly IMediator _mediator;
    private readonly IAppCache _cache;
    private readonly CacheOptions _cacheOptions;

    public GetRecommendationsQueryHandler(IUnitOfWork unitOfWork, IMediator mediator, IAppCache cache, IOptions<CacheOptions> cacheOptions)
    {
        _unitOfWork = unitOfWork;
        _mediator = mediator;
        _cache = cache;
        _cacheOptions = cacheOptions.Value;
    }

    public async Task<Result<RecommendationsDto>> Handle(GetRecommendationsQuery request, CancellationToken cancellationToken)
    {
        var cacheKey = $"recommendations:user:{request.UserId}";
        var result = await _cache.GetOrCreateAsync(
            cacheKey,
            ct => ComputeAsync(request.UserId, ct),
            TimeSpan.FromSeconds(_cacheOptions.AnalyticsSummarySeconds),
            cancellationToken);

        return Result<RecommendationsDto>.Success(result);
    }

    private async Task<RecommendationsDto> ComputeAsync(Guid userId, CancellationToken ct)
    {
        var now = DateTime.UtcNow;
        var reviewQueue = new List<RecommendationItemDto>();
        var nextBest = new List<RecommendationItemDto>();

        // ── Review queue ────────────────────────────────────────────────────────

        // 1. Flashcards due for spaced repetition.
        var dueCards = (await _unitOfWork.FlashcardSrs.GetDueByUserIdAsync(userId, now, ct)).ToList();
        if (dueCards.Count > 0)
        {
            var mostOverdue = dueCards.Max(c => (now - c.Due).TotalDays);
            var priority = (int)Math.Clamp(60 + mostOverdue * 4, 60, 100);
            reviewQueue.Add(new RecommendationItemDto(
                "flashcards-due", "flashcards", $"Review {dueCards.Count} due flashcard{(dueCards.Count == 1 ? "" : "s")}",
                "Spaced repetition is due — review now to keep retention high.", priority, "/flashcards", null, null, dueCards.Count));
        }

        // 2. Quizzes you scored poorly on.
        var submissions = (await _unitOfWork.QuizSubmissions.GetAllByUserAsync(userId, ct))
            .Where(s => s.Total > 0)
            .ToList();
        var weakSubs = submissions
            .Select(s => new { Sub = s, Accuracy = (double)s.Score / s.Total * 100 })
            .Where(x => x.Accuracy < LowAccuracyThreshold)
            .OrderBy(x => x.Accuracy)
            .ThenByDescending(x => x.Sub.SubmittedAt)
            .Take(MaxPerSection)
            .ToList();

        // Batch-resolve titles for the weak-quiz sources instead of one DB round trip per submission.
        var weakDocIds = weakSubs.Where(x => x.Sub.DocumentId.HasValue).Select(x => x.Sub.DocumentId!.Value).ToHashSet();
        var weakVideoIds = weakSubs.Where(x => x.Sub.VideoId.HasValue).Select(x => x.Sub.VideoId!.Value).ToHashSet();
        var docTitles = weakDocIds.Count == 0
            ? new Dictionary<Guid, string>()
            : (await _unitOfWork.Documents.FindAsNoTrackingAsync(d => weakDocIds.Contains(d.DocumentId), ct))
                .ToDictionary(d => d.DocumentId, d => d.FileName);
        var videoTitles = weakVideoIds.Count == 0
            ? new Dictionary<Guid, string>()
            : (await _unitOfWork.Videos.FindAsNoTrackingAsync(v => weakVideoIds.Contains(v.VideoId), ct))
                .ToDictionary(v => v.VideoId, v => v.Title);

        foreach (var x in weakSubs)
        {
            var (title, url) = ResolveSource(x.Sub.DocumentId, x.Sub.VideoId, docTitles, videoTitles);
            reviewQueue.Add(new RecommendationItemDto(
                $"quiz-{x.Sub.SubmissionId}", "quiz", $"Retry quiz: {title}",
                $"You scored {Math.Round(x.Accuracy)}% last time.", (int)Math.Clamp(100 - x.Accuracy, 30, 100),
                url, null, null, null));
        }

        // 3. Unmastered glossary terms.
        var allTerms = (await _unitOfWork.GlossaryTerms.GetByUserWithSourcesAsync(userId, ct)).ToList();
        var masteredTerms = (await _unitOfWork.GlossaryMastered.GetMasteredTermIdsByUserAsync(userId, ct)).ToHashSet();
        var unmasteredTerms = allTerms.Count(t => !masteredTerms.Contains(t.GlossaryTermId));
        if (unmasteredTerms > 0)
        {
            reviewQueue.Add(new RecommendationItemDto(
                "glossary-unmastered", "glossary", $"Master {unmasteredTerms} glossary term{(unmasteredTerms == 1 ? "" : "s")}",
                "Lock in key terms you haven't marked as mastered yet.",
                (int)Math.Clamp(40 + unmasteredTerms, 40, 90), "/glossary", null, null, unmasteredTerms));
        }

        // 4. Unmastered worked problems.
        var problems = (await _unitOfWork.WorkedProblems.GetByUserAsync(userId, null, null, ct)).ToList();
        var masteredProblems = (await _unitOfWork.WorkedProblemMastered.GetMasteredProblemIdsByUserAsync(userId, ct)).ToHashSet();
        var unmasteredProblems = problems.Count(p => !masteredProblems.Contains(p.WorkedProblemId));
        if (unmasteredProblems > 0)
        {
            reviewQueue.Add(new RecommendationItemDto(
                "problems-unmastered", "problems", $"Practice {unmasteredProblems} worked problem{(unmasteredProblems == 1 ? "" : "s")}",
                "Strengthen problem-solving on questions you haven't mastered.",
                (int)Math.Clamp(40 + unmasteredProblems * 2, 40, 90), "/practice", null, null, unmasteredProblems));
        }

        // ── Next best content ───────────────────────────────────────────────────

        // 5. Lowest-mastery courses.
        var masteryResult = await _mediator.Send(new GetCourseMasteryQuery(userId), ct);
        var mastery = (masteryResult.Data ?? Enumerable.Empty<CourseMasteryDto>())
            .Where(c => c.Components.Any() && c.MasteryScore < LowMasteryThreshold)
            .OrderBy(c => c.MasteryScore)
            .Take(MaxPerSection)
            .ToList();
        foreach (var c in mastery)
        {
            nextBest.Add(new RecommendationItemDto(
                $"course-{c.CourseId}", "course", $"Strengthen {c.CourseName}",
                $"Topic mastery is {c.MasteryScore}% — your weakest area.", (int)Math.Clamp(100 - c.MasteryScore, 40, 100),
                $"/courses/{c.CourseId}/study", c.CourseId, c.CourseName, null));
        }

        // 6. Materials you haven't been quizzed on yet.
        var submittedDocIds = submissions.Where(s => s.DocumentId.HasValue).Select(s => s.DocumentId!.Value).ToHashSet();
        var remainingSlots = MaxPerSection - nextBest.Count;
        var untested = remainingSlots <= 0
            ? new List<DocumentListItem>()
            : (await _unitOfWork.Documents.GetRecentUntestedAsync(userId, submittedDocIds, remainingSlots, ct)).ToList();
        foreach (var d in untested)
        {
            nextBest.Add(new RecommendationItemDto(
                $"material-{d.DocumentId}", "material", $"Study {d.FileName}",
                "You haven't been quizzed on this yet — test your understanding.", 50,
                $"/documents/{d.DocumentId}", d.CourseId, null, null));
        }

        return new RecommendationsDto(
            reviewQueue.OrderByDescending(r => r.Priority).Take(MaxPerSection).ToArray(),
            nextBest.OrderByDescending(r => r.Priority).Take(MaxPerSection).ToArray(),
            now);
    }

    private static (string Title, string? Url) ResolveSource(
        Guid? documentId, Guid? videoId, IReadOnlyDictionary<Guid, string> docTitles, IReadOnlyDictionary<Guid, string> videoTitles)
    {
        if (documentId.HasValue && docTitles.TryGetValue(documentId.Value, out var docTitle))
            return (docTitle, $"/documents/{documentId.Value}");
        if (videoId.HasValue && videoTitles.TryGetValue(videoId.Value, out var videoTitle))
            return (videoTitle, $"/videos/{videoId.Value}");
        return ("a previous quiz", null);
    }
}
