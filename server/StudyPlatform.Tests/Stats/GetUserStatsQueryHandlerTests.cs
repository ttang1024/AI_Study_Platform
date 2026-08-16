using System.Linq.Expressions;
using Microsoft.Extensions.Options;
using Moq;
using StudyPlatform.Application.Services;
using StudyPlatform.Application.Settings;
using StudyPlatform.Application.Stats;
using StudyPlatform.Domain.Entities;
using StudyPlatform.Domain.Interfaces;
using StudyPlatform.Domain.Projections;
using Xunit;

namespace StudyPlatform.Tests.Stats;

public class GetUserStatsQueryHandlerTests
{
    private readonly Mock<IUnitOfWork> _uow = new();
    private readonly Mock<IDocumentRepository> _documents = new();
    private readonly Mock<INoteRepository> _notes = new();
    private readonly Mock<IFlashcardRepository> _flashcards = new();
    private readonly Mock<IGlossaryTermRepository> _terms = new();
    private readonly Mock<IQuizRepository> _quizzes = new();
    private readonly Mock<IQuizSubmissionRepository> _submissions = new();
    private readonly Mock<IVideoRepository> _videos = new();
    private readonly Mock<ICourseRepository> _courses = new();
    private readonly GetUserStatsQueryHandler _handler;
    private readonly Guid _userId = Guid.NewGuid();

    public GetUserStatsQueryHandlerTests()
    {
        _uow.Setup(u => u.Documents).Returns(_documents.Object);
        _uow.Setup(u => u.Notes).Returns(_notes.Object);
        _uow.Setup(u => u.Flashcards).Returns(_flashcards.Object);
        _uow.Setup(u => u.GlossaryTerms).Returns(_terms.Object);
        _uow.Setup(u => u.Quizzes).Returns(_quizzes.Object);
        _uow.Setup(u => u.QuizSubmissions).Returns(_submissions.Object);
        _uow.Setup(u => u.Videos).Returns(_videos.Object);
        _uow.Setup(u => u.Courses).Returns(_courses.Object);

        _documents.Setup(r => r.GetMaterialCountsAsync(_userId, default)).ReturnsAsync(new MaterialCounts(2, 1, 0));
        _notes.Setup(r => r.CountAsync(It.IsAny<Expression<Func<Note, bool>>>(), default)).ReturnsAsync(3);
        _flashcards.Setup(r => r.CountAsync(It.IsAny<Expression<Func<Flashcard, bool>>>(), default)).ReturnsAsync(40);
        _terms.Setup(r => r.CountAsync(It.IsAny<Expression<Func<GlossaryTerm, bool>>>(), default)).ReturnsAsync(12);
        _quizzes.Setup(r => r.CountAsync(It.IsAny<Expression<Func<Quiz, bool>>>(), default)).ReturnsAsync(30);
        _submissions.Setup(r => r.CountAsync(It.IsAny<Expression<Func<QuizSubmission, bool>>>(), default)).ReturnsAsync(4);
        _videos.Setup(r => r.CountAsync(It.IsAny<Expression<Func<Video, bool>>>(), default)).ReturnsAsync(6);
        _courses.Setup(r => r.GetListItemsByUserAsync(_userId, default)).ReturnsAsync(Array.Empty<CourseListItem>());
        _documents.Setup(r => r.GetMaterialCountsByCourseAsync(_userId, default))
            .ReturnsAsync(new Dictionary<Guid, MaterialCounts>());
        _videos.Setup(r => r.GetCountsByCourseAsync(_userId, default)).ReturnsAsync(new Dictionary<Guid, int>());
        _submissions.Setup(r => r.GetAchievementsAsync(_userId, default)).ReturnsAsync(new QuizAchievements(2, 4, 87.6));

        var cache = new Mock<IAppCache>();
        cache.Setup(c => c.GetOrCreateAsync(
                It.IsAny<string>(), It.IsAny<Func<CancellationToken, Task<UserStatsDto>>>(),
                It.IsAny<TimeSpan>(), It.IsAny<CancellationToken>()))
            .Returns((string _, Func<CancellationToken, Task<UserStatsDto>> factory, TimeSpan _, CancellationToken ct) => factory(ct));

        _handler = new GetUserStatsQueryHandler(_uow.Object, cache.Object, Options.Create(new CacheOptions()));
    }

    [Fact]
    public async Task Handle_AggregatesCountsAcrossRepositories()
    {
        var result = await _handler.Handle(new GetUserStatsQuery(_userId), default);

        Assert.True(result.IsSuccess);
        Assert.Equal(2, result.Data!.TotalDocuments);
        Assert.Equal(1, result.Data.TotalArticles);
        Assert.Equal(3, result.Data.TotalNotes);
        Assert.Equal(40, result.Data.TotalFlashcards);
        Assert.Equal(12, result.Data.TotalGlossaryTerms);
        Assert.Equal(30, result.Data.TotalQuizQuestions);
        Assert.Equal(4, result.Data.TotalQuizSubmissions);
        Assert.Equal(6, result.Data.TotalVideos);
    }

    [Fact]
    public async Task Handle_TotalMaterialsIncludesVideos()
    {
        var result = await _handler.Handle(new GetUserStatsQuery(_userId), default);

        // materials.Total (Documents+Articles+Audio = 3) + totalVideos (6) = 9
        Assert.Equal(9, result.Data!.TotalMaterials);
    }

    [Fact]
    public async Task Handle_AchievementsMapFromRepository_RoundingAverageScore()
    {
        var result = await _handler.Handle(new GetUserStatsQuery(_userId), default);

        Assert.Equal(2, result.Data!.Achievements.PerfectQuizzes);
        Assert.Equal(88, result.Data.Achievements.AverageQuizScore); // 87.6 rounds to 88
    }

    [Fact]
    public async Task Handle_EveryOwnedCourseGetsARow_EvenWithNoMaterials()
    {
        var courseId = Guid.NewGuid();
        _courses.Setup(r => r.GetListItemsByUserAsync(_userId, default))
            .ReturnsAsync(new[] { new CourseListItem(courseId, _userId, "Algorithms", "#000", 0, DateTime.UtcNow, DateTime.UtcNow) });

        var result = await _handler.Handle(new GetUserStatsQuery(_userId), default);

        var row = Assert.Single(result.Data!.CourseMaterialCounts);
        Assert.Equal(courseId, row.CourseId);
        Assert.Equal(0, row.Total);
    }

    [Fact]
    public async Task Handle_CourseRow_CombinesMaterialAndVideoCounts()
    {
        var courseId = Guid.NewGuid();
        _courses.Setup(r => r.GetListItemsByUserAsync(_userId, default))
            .ReturnsAsync(new[] { new CourseListItem(courseId, _userId, "Algorithms", "#000", 0, DateTime.UtcNow, DateTime.UtcNow) });
        _documents.Setup(r => r.GetMaterialCountsByCourseAsync(_userId, default))
            .ReturnsAsync(new Dictionary<Guid, MaterialCounts> { [courseId] = new MaterialCounts(3, 1, 0) });
        _videos.Setup(r => r.GetCountsByCourseAsync(_userId, default))
            .ReturnsAsync(new Dictionary<Guid, int> { [courseId] = 2 });

        var result = await _handler.Handle(new GetUserStatsQuery(_userId), default);

        var row = result.Data!.CourseMaterialCounts.Single();
        Assert.Equal(3, row.Documents);
        Assert.Equal(1, row.Articles);
        Assert.Equal(2, row.Videos);
        Assert.Equal(6, row.Total); // 3+1+0 material total + 2 videos
    }
}
