using MediatR;
using Microsoft.Extensions.Options;
using StudyPlatform.Application.Common;
using StudyPlatform.Application.Services;
using StudyPlatform.Application.Settings;
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
    private readonly IAppCache _cache;
    private readonly CacheOptions _cacheOptions;

    public GetUserStatsQueryHandler(IUnitOfWork unitOfWork, IAppCache cache, IOptions<CacheOptions> cacheOptions)
    {
        _unitOfWork = unitOfWork;
        _cache = cache;
        _cacheOptions = cacheOptions.Value;
    }

    public async Task<Result<UserStatsDto>> Handle(GetUserStatsQuery request, CancellationToken cancellationToken)
    {
        var stats = await _cache.GetOrCreateAsync(
            $"stats:user:{request.UserId}",
            ct => ComputeAsync(request.UserId, ct),
            TimeSpan.FromSeconds(_cacheOptions.DashboardStatsSeconds),
            cancellationToken);

        return Result<UserStatsDto>.Success(stats);
    }

    private async Task<UserStatsDto> ComputeAsync(Guid userId, CancellationToken cancellationToken)
    {
        // Run sequentially — EF Core DbContext is not thread-safe. The count is constant in the size of
        // the library: the per-course breakdowns come back as two grouped queries, not a COUNT per course.
        var materials = await _unitOfWork.Documents.GetMaterialCountsAsync(userId, cancellationToken);
        var totalNotes = await _unitOfWork.Notes.CountAsync(n => n.UserId == userId, cancellationToken);
        var totalFlashcards = await _unitOfWork.Flashcards.CountAsync(f => f.UserId == userId, cancellationToken);
        var totalGlossaryTerms = await _unitOfWork.GlossaryTerms.CountAsync(g => g.UserId == userId, cancellationToken);
        var totalQuizQuestions = await _unitOfWork.Quizzes.CountAsync(q => q.UserId == userId, cancellationToken);
        var totalQuizSubmissions = await _unitOfWork.QuizSubmissions.CountAsync(q => q.UserId == userId, cancellationToken);
        var totalVideos = await _unitOfWork.Videos.CountAsync(v => v.UserId == userId, cancellationToken);

        var courses = await _unitOfWork.Courses.GetListItemsByUserAsync(userId, cancellationToken);
        var materialsByCourse = await _unitOfWork.Documents.GetMaterialCountsByCourseAsync(userId, cancellationToken);
        var videosByCourse = await _unitOfWork.Videos.GetCountsByCourseAsync(userId, cancellationToken);

        // Every course the user owns gets a row, including the empty ones the grouped queries omit.
        var courseMaterialCounts = courses
            .Select(course =>
            {
                var m = materialsByCourse.GetValueOrDefault(course.CourseId, MaterialCounts.Empty);
                var videos = videosByCourse.GetValueOrDefault(course.CourseId, 0);
                return new CourseMaterialStatsDto(
                    course.CourseId, m.Documents, m.Articles, m.Audio, videos, m.Total + videos);
            })
            .ToList();

        var achievements = await _unitOfWork.QuizSubmissions.GetAchievementsAsync(userId, cancellationToken);

        return new UserStatsDto(
            materials.Documents,
            materials.Articles,
            materials.Audio,
            materials.Total + totalVideos,
            totalNotes,
            totalFlashcards,
            totalGlossaryTerms,
            totalQuizQuestions,
            totalQuizSubmissions,
            totalVideos,
            courseMaterialCounts,
            new AchievementStatsDto(
                achievements.PerfectCount,
                (int)Math.Round(achievements.AverageScorePercent),
                0));
    }
}
