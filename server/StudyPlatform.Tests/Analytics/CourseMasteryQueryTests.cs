using Microsoft.Extensions.Options;
using Moq;
using StudyPlatform.Application.Analytics.DTOs;
using StudyPlatform.Application.Analytics.Queries;
using StudyPlatform.Application.Services;
using StudyPlatform.Application.Settings;
using StudyPlatform.Domain.Entities;
using StudyPlatform.Domain.Interfaces;
using StudyPlatform.Domain.Projections;
using Xunit;

namespace StudyPlatform.Tests.Analytics;

public class GetCourseMasteryQueryHandlerTests
{
    private readonly Mock<IUnitOfWork> _uow = new();
    private readonly Mock<ICourseRepository> _courses = new();
    private readonly Mock<IDocumentRepository> _documents = new();
    private readonly Mock<IVideoRepository> _videos = new();
    private readonly Mock<IFlashcardRepository> _flashcards = new();
    private readonly Mock<IFlashcardSrsDataRepository> _srs = new();
    private readonly Mock<IGlossaryTermRepository> _terms = new();
    private readonly Mock<IGlossaryMasteredRepository> _masteredTerms = new();
    private readonly Mock<IQuizSubmissionRepository> _submissions = new();
    private readonly Mock<IWorkedProblemRepository> _problems = new();
    private readonly Mock<IWorkedProblemMasteredRepository> _masteredProblems = new();
    private readonly GetCourseMasteryQueryHandler _handler;
    private readonly Guid _userId = Guid.NewGuid();
    private readonly Guid _courseId = Guid.NewGuid();

    public GetCourseMasteryQueryHandlerTests()
    {
        _uow.Setup(u => u.Courses).Returns(_courses.Object);
        _uow.Setup(u => u.Documents).Returns(_documents.Object);
        _uow.Setup(u => u.Videos).Returns(_videos.Object);
        _uow.Setup(u => u.Flashcards).Returns(_flashcards.Object);
        _uow.Setup(u => u.FlashcardSrs).Returns(_srs.Object);
        _uow.Setup(u => u.GlossaryTerms).Returns(_terms.Object);
        _uow.Setup(u => u.GlossaryMastered).Returns(_masteredTerms.Object);
        _uow.Setup(u => u.QuizSubmissions).Returns(_submissions.Object);
        _uow.Setup(u => u.WorkedProblems).Returns(_problems.Object);
        _uow.Setup(u => u.WorkedProblemMastered).Returns(_masteredProblems.Object);

        _courses.Setup(r => r.GetListItemsByUserAsync(_userId, default))
            .ReturnsAsync(new List<CourseListItem> { new(_courseId, _userId, "Algorithms", "#123456", 1, DateTime.UtcNow, DateTime.UtcNow) });
        _documents.Setup(r => r.GetDocumentCourseMapAsync(_userId, default)).ReturnsAsync(new Dictionary<Guid, Guid>());
        _videos.Setup(r => r.GetVideoCourseMapAsync(_userId, default)).ReturnsAsync(new Dictionary<Guid, Guid>());
        _flashcards.Setup(r => r.GetByUserIdAsync(_userId, default)).ReturnsAsync(Array.Empty<Flashcard>());
        _srs.Setup(r => r.GetByUserIdAsync(_userId, default)).ReturnsAsync(Array.Empty<FlashcardSrsData>());
        _terms.Setup(r => r.GetByUserWithSourcesAsync(_userId, default)).ReturnsAsync(Array.Empty<GlossaryTerm>());
        _masteredTerms.Setup(r => r.GetMasteredTermIdsByUserAsync(_userId, default)).ReturnsAsync(Array.Empty<Guid>());
        _submissions.Setup(r => r.GetAllByUserAsync(_userId, default)).ReturnsAsync(Array.Empty<QuizSubmission>());
        _problems.Setup(r => r.GetByUserAsync(_userId, null, null, default)).ReturnsAsync(Array.Empty<WorkedProblem>());
        _masteredProblems.Setup(r => r.GetMasteredProblemIdsByUserAsync(_userId, default)).ReturnsAsync(Array.Empty<Guid>());

        var cache = new Mock<IAppCache>();
        cache.Setup(c => c.GetOrCreateAsync(
                It.IsAny<string>(), It.IsAny<Func<CancellationToken, Task<CourseMasteryDto[]>>>(),
                It.IsAny<TimeSpan>(), It.IsAny<CancellationToken>()))
            .Returns((string _, Func<CancellationToken, Task<CourseMasteryDto[]>> factory, TimeSpan _, CancellationToken ct) => factory(ct));

        _handler = new GetCourseMasteryQueryHandler(_uow.Object, cache.Object, Options.Create(new CacheOptions()));
    }

    [Fact]
    public async Task Handle_NoCourses_ReturnsEmpty()
    {
        _courses.Setup(r => r.GetListItemsByUserAsync(_userId, default)).ReturnsAsync(new List<CourseListItem>());

        var result = await _handler.Handle(new GetCourseMasteryQuery(_userId), default);

        Assert.True(result.IsSuccess);
        Assert.Empty(result.Data!);
    }

    [Fact]
    public async Task Handle_CourseWithNoArtifacts_HasZeroScoreAndNoComponents()
    {
        var result = await _handler.Handle(new GetCourseMasteryQuery(_userId), default);

        var course = Assert.Single(result.Data!);
        Assert.Equal(0, course.MasteryScore);
        Assert.Empty(course.Components);
    }

    [Fact]
    public async Task Handle_FlashcardsInReviewState_CountTowardMastery()
    {
        var docId = Guid.NewGuid();
        var cardId = Guid.NewGuid();
        _documents.Setup(r => r.GetDocumentCourseMapAsync(_userId, default)).ReturnsAsync(new Dictionary<Guid, Guid> { [docId] = _courseId });
        _flashcards.Setup(r => r.GetByUserIdAsync(_userId, default)).ReturnsAsync(new[] { new Flashcard { FlashcardId = cardId, DocumentId = docId, Front = "Q", Back = "A" } });
        _srs.Setup(r => r.GetByUserIdAsync(_userId, default)).ReturnsAsync(new[] { new FlashcardSrsData { Id = Guid.NewGuid(), UserId = _userId, FlashcardId = cardId, State = 2 } });

        var result = await _handler.Handle(new GetCourseMasteryQuery(_userId), default);

        var course = Assert.Single(result.Data!);
        var component = Assert.Single(course.Components);
        Assert.Equal("Flashcards", component.Label);
        Assert.Equal(100, component.Score);
        Assert.Equal(100, course.MasteryScore);
    }

    [Fact]
    public async Task Handle_QuizAccuracy_AveragesAcrossSubmissions()
    {
        var docId = Guid.NewGuid();
        _documents.Setup(r => r.GetDocumentCourseMapAsync(_userId, default)).ReturnsAsync(new Dictionary<Guid, Guid> { [docId] = _courseId });
        _submissions.Setup(r => r.GetAllByUserAsync(_userId, default)).ReturnsAsync(new[]
        {
            new QuizSubmission { SubmissionId = Guid.NewGuid(), UserId = _userId, DocumentId = docId, AnswersJson = "{}", Score = 3, Total = 4 },
        });

        var result = await _handler.Handle(new GetCourseMasteryQuery(_userId), default);

        var course = Assert.Single(result.Data!);
        var component = Assert.Single(course.Components);
        Assert.Equal("Quizzes", component.Label);
        Assert.Equal(75, component.Score);
    }

    [Fact]
    public async Task Handle_ArtifactsWithoutCourseAttribution_AreDropped()
    {
        _flashcards.Setup(r => r.GetByUserIdAsync(_userId, default))
            .ReturnsAsync(new[] { new Flashcard { FlashcardId = Guid.NewGuid(), DocumentId = Guid.NewGuid(), Front = "Q", Back = "A" } });

        var result = await _handler.Handle(new GetCourseMasteryQuery(_userId), default);

        var course = Assert.Single(result.Data!);
        Assert.Empty(course.Components);
    }

    [Fact]
    public async Task Handle_CoursesWithComponentsAreOrderedBeforeCoursesWithout()
    {
        var docId = Guid.NewGuid();
        var courseWithData = _courseId;
        var courseWithoutData = Guid.NewGuid();
        _courses.Setup(r => r.GetListItemsByUserAsync(_userId, default)).ReturnsAsync(new List<CourseListItem>
        {
            new(courseWithoutData, _userId, "Empty", "#000000", 0, DateTime.UtcNow, DateTime.UtcNow),
            new(courseWithData, _userId, "Algorithms", "#123456", 1, DateTime.UtcNow, DateTime.UtcNow),
        });
        _documents.Setup(r => r.GetDocumentCourseMapAsync(_userId, default)).ReturnsAsync(new Dictionary<Guid, Guid> { [docId] = courseWithData });
        _flashcards.Setup(r => r.GetByUserIdAsync(_userId, default)).ReturnsAsync(new[] { new Flashcard { FlashcardId = Guid.NewGuid(), DocumentId = docId, Front = "Q", Back = "A" } });

        var result = await _handler.Handle(new GetCourseMasteryQuery(_userId), default);

        Assert.Equal(courseWithData, result.Data!.First().CourseId);
    }
}
