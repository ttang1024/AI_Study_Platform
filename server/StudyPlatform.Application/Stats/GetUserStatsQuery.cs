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
    IEnumerable<CourseMaterialStatsDto> CourseMaterialCounts);

public record GetUserStatsQuery(Guid UserId) : IRequest<Result<UserStatsDto>>;

public class GetUserStatsQueryHandler : IRequestHandler<GetUserStatsQuery, Result<UserStatsDto>>
{
    private readonly ICourseRepository _courses;
    private readonly IDocumentRepository _documents;
    private readonly IQuizRepository _quizzes;
    private readonly IFlashcardRepository _flashcards;
    private readonly INoteRepository _notes;
    private readonly IQuizSubmissionRepository _quizSubmissions;
    private readonly IVideoRepository _videos;
    private readonly IGlossaryTermRepository _glossaryTerms;
    private readonly IAppCache _cache;
    private readonly CacheOptions _cacheOptions;

    public GetUserStatsQueryHandler(ICourseRepository courses, IDocumentRepository documents, IQuizRepository quizzes, IFlashcardRepository flashcards, INoteRepository notes, IQuizSubmissionRepository quizSubmissions, IVideoRepository videos, IGlossaryTermRepository glossaryTerms, IAppCache cache, IOptions<CacheOptions> cacheOptions)
    {
        _courses = courses;
        _documents = documents;
        _quizzes = quizzes;
        _flashcards = flashcards;
        _notes = notes;
        _quizSubmissions = quizSubmissions;
        _videos = videos;
        _glossaryTerms = glossaryTerms;
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
        var materials = await _documents.GetMaterialCountsAsync(userId, cancellationToken);
        var totalNotes = await _notes.CountAsync(n => n.UserId == userId, cancellationToken);
        var totalFlashcards = await _flashcards.CountAsync(f => f.UserId == userId, cancellationToken);
        var totalGlossaryTerms = await _glossaryTerms.CountAsync(g => g.UserId == userId, cancellationToken);
        var totalQuizQuestions = await _quizzes.CountAsync(q => q.UserId == userId, cancellationToken);
        var totalQuizSubmissions = await _quizSubmissions.CountAsync(q => q.UserId == userId, cancellationToken);
        var totalVideos = await _videos.CountAsync(v => v.UserId == userId, cancellationToken);

        var courses = await _courses.GetListItemsByUserAsync(userId, cancellationToken);
        var materialsByCourse = await _documents.GetMaterialCountsByCourseAsync(userId, cancellationToken);
        var videosByCourse = await _videos.GetCountsByCourseAsync(userId, cancellationToken);

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
            courseMaterialCounts);
    }
}
