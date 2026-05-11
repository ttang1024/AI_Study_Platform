using MediatR;
using StudyPlatform.Application.Common;
using StudyPlatform.Domain.Entities;
using StudyPlatform.Domain.Interfaces;

namespace StudyPlatform.Application.StudyQueue;

public record DailyStudyQueueItemDto(
    Guid Id,
    string Type,
    string Title,
    string Description,
    string? SourceName,
    string? CourseName,
    string? CourseColor,
    string ActionUrl,
    int Priority,
    int EstimatedMinutes,
    int Count,
    string Reason);

public record DailyStudyQueueDto(
    DateTime GeneratedAt,
    int TotalTasks,
    int EstimatedMinutes,
    IEnumerable<DailyStudyQueueItemDto> Items);

public record GetDailyStudyQueueQuery(Guid UserId, int Limit = 8) : IRequest<Result<DailyStudyQueueDto>>;

public class GetDailyStudyQueueQueryHandler : IRequestHandler<GetDailyStudyQueueQuery, Result<DailyStudyQueueDto>>
{
    private readonly IUnitOfWork _unitOfWork;

    public GetDailyStudyQueueQueryHandler(IUnitOfWork unitOfWork)
    {
        _unitOfWork = unitOfWork;
    }

    public async Task<Result<DailyStudyQueueDto>> Handle(GetDailyStudyQueueQuery request, CancellationToken cancellationToken)
    {
        var userId = request.UserId;
        var limit = Math.Clamp(request.Limit, 1, 20);

        var courses = (await _unitOfWork.Courses.FindAsync(c => c.UserId == userId, cancellationToken))
            .ToDictionary(c => c.CourseId);
        var documents = (await _unitOfWork.Documents.FindAsync(d => d.UserId == userId, cancellationToken))
            .ToDictionary(d => d.DocumentId);
        var videos = (await _unitOfWork.YouTubeVideos.FindAsync(v => v.UserId == userId, cancellationToken))
            .ToDictionary(v => v.YouTubeVideoId);

        var items = new List<DailyStudyQueueItemDto>();
        await AddGlossaryItems(userId, items, documents, videos, courses, cancellationToken);
        await AddQuizItems(userId, items, documents, videos, courses, cancellationToken);
        await AddWorkedProblemItems(userId, items, documents, videos, courses, cancellationToken);
        await AddFlashcardItems(userId, items, documents, videos, courses, cancellationToken);

        var rankedItems = items
            .OrderByDescending(i => i.Priority)
            .ThenBy(i => i.EstimatedMinutes)
            .ThenBy(i => i.Title)
            .Take(limit)
            .ToList();

        var dto = new DailyStudyQueueDto(
            DateTime.UtcNow,
            rankedItems.Sum(i => i.Count),
            rankedItems.Sum(i => i.EstimatedMinutes),
            rankedItems);

        return Result<DailyStudyQueueDto>.Success(dto);
    }

    private async Task AddGlossaryItems(
        Guid userId,
        List<DailyStudyQueueItemDto> items,
        Dictionary<Guid, Document> documents,
        Dictionary<Guid, YouTubeVideo> videos,
        Dictionary<Guid, Course> courses,
        CancellationToken cancellationToken)
    {
        var masteredIds = (await _unitOfWork.GlossaryMastered.GetMasteredTermIdsByUserAsync(userId, cancellationToken)).ToHashSet();
        var unmastered = (await _unitOfWork.GlossaryTerms.FindAsync(g => g.UserId == userId, cancellationToken))
            .Where(g => !masteredIds.Contains(g.GlossaryTermId))
            .OrderBy(g => g.CreatedAt)
            .Take(12)
            .ToList();

        if (unmastered.Count == 0) return;

        var first = unmastered[0];
        var source = ResolveSource(first.DocumentId, first.YouTubeVideoId, documents, videos, courses);
        items.Add(new DailyStudyQueueItemDto(
            first.GlossaryTermId,
            "glossary",
            $"Master {unmastered.Count} glossary terms",
            string.Join(", ", unmastered.Take(3).Select(g => g.Term)),
            source.SourceName,
            source.CourseName,
            source.CourseColor,
            "/glossary?mastery=unmastered",
            95,
            Math.Max(3, (int)Math.Ceiling(unmastered.Count * 0.75)),
            unmastered.Count,
            "Unmastered terms are blocking recall."));
    }

    private async Task AddQuizItems(
        Guid userId,
        List<DailyStudyQueueItemDto> items,
        Dictionary<Guid, Document> documents,
        Dictionary<Guid, YouTubeVideo> videos,
        Dictionary<Guid, Course> courses,
        CancellationToken cancellationToken)
    {
        var weakSubmissions = (await _unitOfWork.QuizSubmissions.FindAsync(
                q => q.UserId == userId && q.Total > 0 && q.Score < q.Total,
                cancellationToken))
            .OrderBy(q => q.Score / (double)q.Total)
            .ThenByDescending(q => q.SubmittedAt)
            .Take(4)
            .ToList();

        foreach (var submission in weakSubmissions)
        {
            var source = ResolveSource(submission.DocumentId, submission.YouTubeVideoId, documents, videos, courses);
            var percentage = (int)Math.Round(submission.Score / (double)submission.Total * 100);
            items.Add(new DailyStudyQueueItemDto(
                submission.SubmissionId,
                "quiz",
                $"Redo quiz: {source.SourceName ?? "recent material"}",
                $"{submission.Score}/{submission.Total} correct ({percentage}%).",
                source.SourceName,
                source.CourseName,
                source.CourseColor,
                "/quizzes",
                90 - percentage / 5,
                8,
                Math.Max(1, submission.Total - submission.Score),
                "Recent quiz misses need correction."));
        }
    }

    private async Task AddWorkedProblemItems(
        Guid userId,
        List<DailyStudyQueueItemDto> items,
        Dictionary<Guid, Document> documents,
        Dictionary<Guid, YouTubeVideo> videos,
        Dictionary<Guid, Course> courses,
        CancellationToken cancellationToken)
    {
        var problems = (await _unitOfWork.WorkedProblems.GetByUserAsync(userId, null, null, cancellationToken))
            .ToList();
        var latestAttempts = new Dictionary<Guid, WorkedProblemAttempt>();
        foreach (var problem in problems)
        {
            var latestAttempt = (await _unitOfWork.WorkedProblemAttempts.GetByProblemAsync(
                    problem.WorkedProblemId,
                    userId,
                    cancellationToken))
                .FirstOrDefault();
            if (latestAttempt != null)
                latestAttempts[problem.WorkedProblemId] = latestAttempt;
        }

        var dueProblems = problems
            .Where(p => !latestAttempts.TryGetValue(p.WorkedProblemId, out var latest) || latest.IsCorrect != true)
            .OrderByDescending(p => latestAttempts.ContainsKey(p.WorkedProblemId))
            .ThenByDescending(p => p.CreatedAt)
            .Take(5)
            .ToList();

        if (dueProblems.Count == 0) return;

        var first = dueProblems[0];
        var source = ResolveSource(first.DocumentId, first.YouTubeVideoId, documents, videos, courses);
        items.Add(new DailyStudyQueueItemDto(
            first.WorkedProblemId,
            "workedProblem",
            $"Practice {dueProblems.Count} worked problems",
            first.Topic ?? first.ProblemText,
            source.SourceName,
            source.CourseName,
            source.CourseColor,
            source.ActionUrl,
            82,
            dueProblems.Count * 6,
            dueProblems.Count,
            "Unattempted or incorrect worked problems are due."));
    }

    private async Task AddFlashcardItems(
        Guid userId,
        List<DailyStudyQueueItemDto> items,
        Dictionary<Guid, Document> documents,
        Dictionary<Guid, YouTubeVideo> videos,
        Dictionary<Guid, Course> courses,
        CancellationToken cancellationToken)
    {
        var flashcards = (await _unitOfWork.Flashcards.FindAsync(f => f.UserId == userId, cancellationToken))
            .OrderBy(f => f.UpdatedAt)
            .Take(15)
            .ToList();

        if (flashcards.Count == 0) return;

        var first = flashcards[0];
        var source = ResolveSource(first.DocumentId, first.YouTubeVideoId, documents, videos, courses);
        items.Add(new DailyStudyQueueItemDto(
            first.FlashcardId,
            "flashcards",
            $"Review {flashcards.Count} flashcards",
            first.Front,
            source.SourceName,
            source.CourseName,
            source.CourseColor,
            "/flashcards",
            70,
            Math.Max(5, (int)Math.Ceiling(flashcards.Count * 0.5)),
            flashcards.Count,
            "Oldest flashcards are ready for active recall."));
    }

    private static (string? SourceName, string? CourseName, string? CourseColor, string ActionUrl) ResolveSource(
        Guid? documentId,
        Guid? videoId,
        Dictionary<Guid, Document> documents,
        Dictionary<Guid, YouTubeVideo> videos,
        Dictionary<Guid, Course> courses)
    {
        if (videoId.HasValue && videos.TryGetValue(videoId.Value, out var video))
        {
            courses.TryGetValue(video.CourseId, out var course);
            return (video.Title, course?.CourseName, course?.CourseColor, $"/youtube/{video.YouTubeVideoId}");
        }

        if (documentId.HasValue && documents.TryGetValue(documentId.Value, out var document))
        {
            courses.TryGetValue(document.CourseId, out var course);
            var actionUrl = document.ContentType.StartsWith("audio/") || document.ContentType == "audio/podcast"
                ? $"/audio/{document.DocumentId}"
                : document.OriginalUrl != null
                    ? $"/articles/{document.DocumentId}"
                    : $"/documents/{document.DocumentId}";
            return (document.FileName, course?.CourseName, course?.CourseColor, actionUrl);
        }

        return (null, null, null, "/dashboard");
    }
}
