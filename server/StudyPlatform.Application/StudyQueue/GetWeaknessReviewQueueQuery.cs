using System.Text.Json;
using MediatR;
using StudyPlatform.Application.Common;
using StudyPlatform.Domain.Entities;
using StudyPlatform.Domain.Interfaces;

namespace StudyPlatform.Application.StudyQueue;

public record WeaknessReviewSourceDto(
    string? Name,
    string? CourseName,
    string? CourseColor,
    string ActionUrl);

public record WeaknessReviewItemDto(
    Guid Id,
    string Type,
    string Title,
    string Prompt,
    string? Answer,
    string Reason,
    int Priority,
    int EstimatedMinutes,
    WeaknessReviewSourceDto Source,
    string? UserAnswer = null,
    int Attempts = 1);

public record WeaknessReviewSectionDto(
    string Type,
    string Title,
    string Description,
    int EstimatedMinutes,
    IEnumerable<WeaknessReviewItemDto> Items);

public record WeaknessReviewQueueDto(
    DateTime GeneratedAt,
    int TotalItems,
    int EstimatedMinutes,
    IEnumerable<WeaknessReviewSectionDto> Sections);

public record GetWeaknessReviewQueueQuery(Guid UserId, int LimitPerSection = 8) : IRequest<Result<WeaknessReviewQueueDto>>;

public class GetWeaknessReviewQueueQueryHandler : IRequestHandler<GetWeaknessReviewQueueQuery, Result<WeaknessReviewQueueDto>>
{
    private readonly IUnitOfWork _unitOfWork;

    public GetWeaknessReviewQueueQueryHandler(IUnitOfWork unitOfWork)
    {
        _unitOfWork = unitOfWork;
    }

    public async Task<Result<WeaknessReviewQueueDto>> Handle(GetWeaknessReviewQueueQuery request, CancellationToken cancellationToken)
    {
        var limit = Math.Clamp(request.LimitPerSection, 1, 20);
        var courses = (await _unitOfWork.Courses.FindAsync(c => c.UserId == request.UserId, cancellationToken)).ToDictionary(c => c.CourseId);
        var documents = (await _unitOfWork.Documents.FindAsync(d => d.UserId == request.UserId, cancellationToken)).ToDictionary(d => d.DocumentId);
        var videos = (await _unitOfWork.YouTubeVideos.FindAsync(v => v.UserId == request.UserId, cancellationToken)).ToDictionary(v => v.YouTubeVideoId);

        var sections = new List<WeaknessReviewSectionDto>
        {
            await BuildDueFlashcardsSection(request.UserId, limit, documents, videos, courses, cancellationToken),
            await BuildFailedQuizSection(request.UserId, limit, documents, videos, courses, cancellationToken),
            await BuildUnmasteredGlossarySection(request.UserId, limit, documents, videos, courses, cancellationToken),
            await BuildTutorConceptsSection(request.UserId, limit, documents, videos, courses, cancellationToken)
        }
        .Where(section => section.Items.Any())
        .ToList();

        var dto = new WeaknessReviewQueueDto(
            DateTime.UtcNow,
            sections.Sum(section => section.Items.Count()),
            sections.Sum(section => section.EstimatedMinutes),
            sections);

        return Result<WeaknessReviewQueueDto>.Success(dto);
    }

    private async Task<WeaknessReviewSectionDto> BuildDueFlashcardsSection(
        Guid userId,
        int limit,
        Dictionary<Guid, Document> documents,
        Dictionary<Guid, YouTubeVideo> videos,
        Dictionary<Guid, Course> courses,
        CancellationToken cancellationToken)
    {
        var dueCutoff = DateTime.UtcNow.Date.AddDays(1);
        var cards = (await _unitOfWork.Flashcards.FindAsync(f => f.UserId == userId && f.UpdatedAt < dueCutoff, cancellationToken))
            .OrderBy(f => f.UpdatedAt)
            .Take(limit)
            .Select(card =>
            {
                var source = ResolveSource(card.DocumentId, card.YouTubeVideoId, documents, videos, courses);
                var ageDays = Math.Max(0, (DateTime.UtcNow.Date - card.UpdatedAt.Date).Days);
                return new WeaknessReviewItemDto(
                    card.FlashcardId,
                    "flashcard",
                    card.Front,
                    card.Front,
                    card.Back,
                    ageDays == 0 ? "Due for active recall today." : $"Last touched {ageDays} day{(ageDays == 1 ? "" : "s")} ago.",
                    80 + Math.Min(ageDays, 20),
                    1,
                    source);
            })
            .ToList();

        return new WeaknessReviewSectionDto(
            "flashcards",
            "Due flashcards",
            "Oldest cards first, based on the available review timestamp.",
            Math.Max(3, cards.Count),
            cards);
    }

    private async Task<WeaknessReviewSectionDto> BuildFailedQuizSection(
        Guid userId,
        int limit,
        Dictionary<Guid, Document> documents,
        Dictionary<Guid, YouTubeVideo> videos,
        Dictionary<Guid, Course> courses,
        CancellationToken cancellationToken)
    {
        var quizzes = (await _unitOfWork.Quizzes.FindAsync(q => q.UserId == userId, cancellationToken))
            .ToDictionary(q => q.QuizId);
        var submissions = (await _unitOfWork.QuizSubmissions.FindAsync(
                s => s.UserId == userId && s.Total > 0 && s.Score < s.Total,
                cancellationToken))
            .OrderByDescending(s => s.SubmittedAt)
            .ToList();

        var failed = new List<WeaknessReviewItemDto>();
        foreach (var submission in submissions)
        {
            var answers = ParseAnswers(submission.AnswersJson);
            foreach (var answer in answers)
            {
                if (!Guid.TryParse(answer.Key, out var quizId) || !quizzes.TryGetValue(quizId, out var quiz))
                    continue;
                if (string.Equals(answer.Value?.Trim(), quiz.CorrectAnswer.Trim(), StringComparison.OrdinalIgnoreCase))
                    continue;

                var source = ResolveSource(submission.DocumentId ?? quiz.DocumentId, submission.YouTubeVideoId ?? quiz.YouTubeVideoId, documents, videos, courses);
                failed.Add(new WeaknessReviewItemDto(
                    quiz.QuizId,
                    "quiz",
                    quiz.Question,
                    quiz.Question,
                    quiz.CorrectAnswer,
                    "Missed on your latest quiz attempt.",
                    96,
                    2,
                    source,
                    answer.Value,
                    1));
            }
        }

        var items = failed
            .GroupBy(item => item.Id)
            .Select(group => group.First() with { Attempts = group.Count(), Priority = 96 + Math.Min(group.Count(), 8) })
            .OrderByDescending(item => item.Priority)
            .Take(limit)
            .ToList();

        return new WeaknessReviewSectionDto(
            "quizzes",
            "Failed quiz questions",
            "Questions you answered incorrectly and should repair before moving on.",
            items.Count * 2,
            items);
    }

    private async Task<WeaknessReviewSectionDto> BuildUnmasteredGlossarySection(
        Guid userId,
        int limit,
        Dictionary<Guid, Document> documents,
        Dictionary<Guid, YouTubeVideo> videos,
        Dictionary<Guid, Course> courses,
        CancellationToken cancellationToken)
    {
        var masteredIds = (await _unitOfWork.GlossaryMastered.GetMasteredTermIdsByUserAsync(userId, cancellationToken)).ToHashSet();
        var items = (await _unitOfWork.GlossaryTerms.FindAsync(g => g.UserId == userId, cancellationToken))
            .Where(term => !masteredIds.Contains(term.GlossaryTermId))
            .OrderBy(term => term.CreatedAt)
            .Take(limit)
            .Select(term => new WeaknessReviewItemDto(
                term.GlossaryTermId,
                "glossary",
                term.Term,
                term.Term,
                term.Definition,
                "Still marked as learning in your glossary.",
                88,
                1,
                ResolveSource(term.DocumentId, term.YouTubeVideoId, documents, videos, courses)))
            .ToList();

        return new WeaknessReviewSectionDto(
            "glossary",
            "Unmastered glossary terms",
            "Terms not yet marked mastered.",
            Math.Max(3, items.Count),
            items);
    }

    private async Task<WeaknessReviewSectionDto> BuildTutorConceptsSection(
        Guid userId,
        int limit,
        Dictionary<Guid, Document> documents,
        Dictionary<Guid, YouTubeVideo> videos,
        Dictionary<Guid, Course> courses,
        CancellationToken cancellationToken)
    {
        var messages = (await _unitOfWork.ChatMessages.FindAsync(
                message => message.UserId == userId && message.Role == "user",
                cancellationToken))
            .OrderByDescending(message => message.CreatedAt)
            .Take(300)
            .ToList();

        var glossaryTerms = (await _unitOfWork.GlossaryTerms.FindAsync(g => g.UserId == userId, cancellationToken)).ToList();
        var conceptHits = new Dictionary<Guid, (GlossaryTerm Term, int Count, DateTime LastAsked)>();

        foreach (var term in glossaryTerms.Where(t => t.Term.Length >= 3))
        {
            var matchingMessages = messages
                .Where(message => message.Content.Contains(term.Term, StringComparison.OrdinalIgnoreCase))
                .ToList();
            if (matchingMessages.Count < 2) continue;
            conceptHits[term.GlossaryTermId] = (term, matchingMessages.Count, matchingMessages.Max(m => m.CreatedAt));
        }

        var items = conceptHits.Values
            .OrderByDescending(hit => hit.Count)
            .ThenByDescending(hit => hit.LastAsked)
            .Take(limit)
            .Select(hit => new WeaknessReviewItemDto(
                hit.Term.GlossaryTermId,
                "tutorConcept",
                hit.Term.Term,
                hit.Term.Term,
                hit.Term.Definition,
                $"Asked the AI tutor about this {hit.Count} times.",
                92 + Math.Min(hit.Count, 8),
                2,
                ResolveSource(hit.Term.DocumentId, hit.Term.YouTubeVideoId, documents, videos, courses),
                Attempts: hit.Count))
            .ToList();

        return new WeaknessReviewSectionDto(
            "tutorConcepts",
            "Repeated AI tutor concepts",
            "Concepts you keep asking about in tutor chats.",
            items.Count * 2,
            items);
    }

    private static Dictionary<string, string?> ParseAnswers(string answersJson)
    {
        if (string.IsNullOrWhiteSpace(answersJson)) return new Dictionary<string, string?>();
        try
        {
            return JsonSerializer.Deserialize<Dictionary<string, string?>>(answersJson) ?? new Dictionary<string, string?>();
        }
        catch
        {
            return new Dictionary<string, string?>();
        }
    }

    private static WeaknessReviewSourceDto ResolveSource(
        Guid? documentId,
        Guid? videoId,
        Dictionary<Guid, Document> documents,
        Dictionary<Guid, YouTubeVideo> videos,
        Dictionary<Guid, Course> courses)
    {
        if (videoId.HasValue && videos.TryGetValue(videoId.Value, out var video))
        {
            courses.TryGetValue(video.CourseId, out var course);
            return new WeaknessReviewSourceDto(video.Title, course?.CourseName, course?.CourseColor, $"/youtube/{video.YouTubeVideoId}");
        }

        if (documentId.HasValue && documents.TryGetValue(documentId.Value, out var document))
        {
            courses.TryGetValue(document.CourseId, out var course);
            var actionUrl = document.ContentType.StartsWith("audio/") || document.ContentType == "audio/podcast"
                ? $"/audio/{document.DocumentId}"
                : document.OriginalUrl != null
                    ? $"/articles/{document.DocumentId}"
                    : $"/documents/{document.DocumentId}";
            return new WeaknessReviewSourceDto(document.FileName, course?.CourseName, course?.CourseColor, actionUrl);
        }

        return new WeaknessReviewSourceDto(null, null, null, "/dashboard");
    }
}
