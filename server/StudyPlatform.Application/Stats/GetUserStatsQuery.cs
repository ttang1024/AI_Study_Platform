using MediatR;
using StudyPlatform.Application.Common;
using StudyPlatform.Domain.Interfaces;

namespace StudyPlatform.Application.Stats;

public record CourseMaterialStatsDto(
    Guid CourseId,
    int Documents,
    int Articles,
    int Audio,
    int Videos,
    int Total);

public record AchievementStatsDto(
    int PerfectQuizzes,
    int AverageQuizScore,
    int FlashcardsMastered);

public record UserStatsDto(
    int TotalDocuments,
    int TotalArticles,
    int TotalAudio,
    int TotalMaterials,
    int TotalNotes,
    int TotalFlashcards,
    int TotalGlossaryTerms,
    int TotalQuizQuestions,
    int TotalQuizSubmissions,
    int TotalVideos,
    IEnumerable<CourseMaterialStatsDto> CourseMaterialCounts,
    AchievementStatsDto Achievements);

public record GetUserStatsQuery(Guid UserId) : IRequest<Result<UserStatsDto>>;

public class GetUserStatsQueryHandler : IRequestHandler<GetUserStatsQuery, Result<UserStatsDto>>
{
    private readonly IUnitOfWork _unitOfWork;

    public GetUserStatsQueryHandler(IUnitOfWork unitOfWork)
    {
        _unitOfWork = unitOfWork;
    }

    public async Task<Result<UserStatsDto>> Handle(GetUserStatsQuery request, CancellationToken cancellationToken)
    {
        var userId = request.UserId;

        // Run sequentially — EF Core DbContext is not thread-safe.
        var totalArticles = await _unitOfWork.Documents.CountAsync(d => d.UserId == userId && d.OriginalUrl != null && d.ContentType.StartsWith("text/"), cancellationToken);
        var totalAudio = await _unitOfWork.Documents.CountAsync(d => d.UserId == userId && (d.ContentType == "audio/podcast" || d.ContentType.StartsWith("audio/")), cancellationToken);
        var totalDocuments = await _unitOfWork.Documents.CountAsync(d => d.UserId == userId && !(d.OriginalUrl != null && d.ContentType.StartsWith("text/")) && !(d.ContentType == "audio/podcast" || d.ContentType.StartsWith("audio/")), cancellationToken);
        var totalNotes = await _unitOfWork.Notes.CountAsync(n => n.UserId == userId, cancellationToken);
        var totalFlashcards = await _unitOfWork.Flashcards.CountAsync(f => f.UserId == userId, cancellationToken);
        var totalGlossaryTerms = await _unitOfWork.GlossaryTerms.CountAsync(g => g.UserId == userId, cancellationToken);
        var totalQuizQuestions = await _unitOfWork.Quizzes.CountAsync(q => q.UserId == userId, cancellationToken);
        var totalQuizSubmissions = await _unitOfWork.QuizSubmissions.CountAsync(q => q.UserId == userId, cancellationToken);
        var totalVideos = await _unitOfWork.Videos.CountAsync(v => v.UserId == userId, cancellationToken);

        var courseMaterialCounts = new List<CourseMaterialStatsDto>();
        var courses = await _unitOfWork.Courses.FindAsync(c => c.UserId == userId, cancellationToken);
        foreach (var course in courses)
        {
            var courseId = course.CourseId;
            var documentCount = await _unitOfWork.Documents.CountAsync(d => d.UserId == userId && d.CourseId == courseId && !(d.OriginalUrl != null && d.ContentType.StartsWith("text/")) && !(d.ContentType == "audio/podcast" || d.ContentType.StartsWith("audio/")), cancellationToken);
            var articleCount = await _unitOfWork.Documents.CountAsync(d => d.UserId == userId && d.CourseId == courseId && d.OriginalUrl != null && d.ContentType.StartsWith("text/"), cancellationToken);
            var audioCount = await _unitOfWork.Documents.CountAsync(d => d.UserId == userId && d.CourseId == courseId && (d.ContentType == "audio/podcast" || d.ContentType.StartsWith("audio/")), cancellationToken);
            var videoCount = await _unitOfWork.Videos.CountAsync(v => v.UserId == userId && v.CourseId == courseId, cancellationToken);
            courseMaterialCounts.Add(new CourseMaterialStatsDto(courseId, documentCount, articleCount, audioCount, videoCount, documentCount + articleCount + audioCount + videoCount));
        }

        var quizSubmissions = (await _unitOfWork.QuizSubmissions.FindAsync(q => q.UserId == userId, cancellationToken)).ToList();
        var perfectQuizzes = quizSubmissions.Count(q => q.Total > 0 && q.Score == q.Total);
        var scoredQuizSubmissions = quizSubmissions.Where(q => q.Total > 0).ToList();
        var averageQuizScore = scoredQuizSubmissions.Count > 0
            ? (int)Math.Round(scoredQuizSubmissions.Average(q => (q.Score / (double)q.Total) * 100))
            : 0;
        var stats = new UserStatsDto(
            totalDocuments,
            totalArticles,
            totalAudio,
            totalDocuments + totalArticles + totalAudio + totalVideos,
            totalNotes,
            totalFlashcards,
            totalGlossaryTerms,
            totalQuizQuestions,
            totalQuizSubmissions,
            totalVideos,
            courseMaterialCounts,
            new AchievementStatsDto(perfectQuizzes, averageQuizScore, 0));

        return Result<UserStatsDto>.Success(stats);
    }
}
