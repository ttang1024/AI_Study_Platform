using Moq;
using StudyPlatform.Application.Flashcards.Commands;
using StudyPlatform.Application.Services;
using StudyPlatform.Domain.Entities;
using StudyPlatform.Domain.Interfaces;
using Xunit;

namespace StudyPlatform.Tests.Flashcards;

public class ExportFlashcardsToAnkiQueryHandlerTests
{
    private readonly Mock<IUnitOfWork> _uow = new();
    private readonly Mock<IFlashcardRepository> _flashcards = new();
    private readonly Mock<ICourseRepository> _courses = new();
    private readonly Mock<IDocumentRepository> _documents = new();
    private readonly Mock<IVideoRepository> _videos = new();
    private readonly Mock<IFlashcardSrsDataRepository> _srs = new();
    private readonly Mock<IAnkiExportService> _ankiExport = new();
    private readonly ExportFlashcardsToAnkiQueryHandler _handler;
    private readonly Guid _userId = Guid.NewGuid();

    public ExportFlashcardsToAnkiQueryHandlerTests()
    {
        _uow.Setup(u => u.Flashcards).Returns(_flashcards.Object);
        _uow.Setup(u => u.Courses).Returns(_courses.Object);
        _uow.Setup(u => u.Documents).Returns(_documents.Object);
        _uow.Setup(u => u.Videos).Returns(_videos.Object);
        _uow.Setup(u => u.FlashcardSrs).Returns(_srs.Object);
        _srs.Setup(r => r.GetByUserIdAsync(_userId, default)).ReturnsAsync(Array.Empty<FlashcardSrsData>());
        _ankiExport.Setup(a => a.BuildPackage(It.IsAny<string>(), It.IsAny<IReadOnlyList<AnkiExportCard>>()))
            .Returns(new byte[] { 1, 2, 3 });
        _handler = new ExportFlashcardsToAnkiQueryHandler(_uow.Object, _ankiExport.Object);
    }

    [Fact]
    public async Task Handle_NoFlashcards_ReturnsFailure()
    {
        _flashcards.Setup(r => r.GetByUserIdAsync(_userId, default)).ReturnsAsync(Array.Empty<Flashcard>());

        var result = await _handler.Handle(new ExportFlashcardsToAnkiQuery(_userId), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("NO_FLASHCARDS", result.ErrorCode);
    }

    [Fact]
    public async Task Handle_CourseNotOwned_ReturnsFailure()
    {
        var courseId = Guid.NewGuid();
        _flashcards.Setup(r => r.GetByUserIdAsync(_userId, default)).ReturnsAsync(new[] { new Flashcard { FlashcardId = Guid.NewGuid(), Front = "F", Back = "B" } });
        _courses.Setup(r => r.GetByIdAsync(courseId, default)).ReturnsAsync((Course?)null);

        var result = await _handler.Handle(new ExportFlashcardsToAnkiQuery(_userId, courseId), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("COURSE_NOT_FOUND", result.ErrorCode);
    }

    [Fact]
    public async Task Handle_NoCourseFilter_UsesDefaultDeckName()
    {
        _flashcards.Setup(r => r.GetByUserIdAsync(_userId, default)).ReturnsAsync(new[] { new Flashcard { FlashcardId = Guid.NewGuid(), Front = "F", Back = "B" } });
        string? capturedDeck = null;
        _ankiExport.Setup(a => a.BuildPackage(It.IsAny<string>(), It.IsAny<IReadOnlyList<AnkiExportCard>>()))
            .Callback<string, IReadOnlyList<AnkiExportCard>>((deck, _) => capturedDeck = deck)
            .Returns(new byte[] { 1 });

        await _handler.Handle(new ExportFlashcardsToAnkiQuery(_userId), default);

        Assert.Equal("Study Platform", capturedDeck);
    }

    [Fact]
    public async Task Handle_CourseFilter_ExcludesCardsFromOtherCourses()
    {
        var courseId = Guid.NewGuid();
        var docInCourse = Guid.NewGuid();
        var docOutOfCourse = Guid.NewGuid();
        _courses.Setup(r => r.GetByIdAsync(courseId, default)).ReturnsAsync(new Course { CourseId = courseId, UserId = _userId, CourseName = "Algorithms" });
        _documents.Setup(r => r.GetDocumentCourseMapAsync(_userId, default))
            .ReturnsAsync(new Dictionary<Guid, Guid> { [docInCourse] = courseId, [docOutOfCourse] = Guid.NewGuid() });
        _videos.Setup(r => r.GetVideoCourseMapAsync(_userId, default)).ReturnsAsync(new Dictionary<Guid, Guid>());
        _flashcards.Setup(r => r.GetByUserIdAsync(_userId, default)).ReturnsAsync(new[]
        {
            new Flashcard { FlashcardId = Guid.NewGuid(), DocumentId = docInCourse, Front = "In", Back = "B" },
            new Flashcard { FlashcardId = Guid.NewGuid(), DocumentId = docOutOfCourse, Front = "Out", Back = "B" },
        });
        IReadOnlyList<AnkiExportCard>? capturedCards = null;
        _ankiExport.Setup(a => a.BuildPackage(It.IsAny<string>(), It.IsAny<IReadOnlyList<AnkiExportCard>>()))
            .Callback<string, IReadOnlyList<AnkiExportCard>>((_, cards) => capturedCards = cards)
            .Returns(new byte[] { 1 });

        var result = await _handler.Handle(new ExportFlashcardsToAnkiQuery(_userId, courseId), default);

        Assert.True(result.IsSuccess);
        Assert.Single(capturedCards!);
        Assert.Equal("In", capturedCards![0].Front);
    }

    [Fact]
    public async Task Handle_OcclusionCardWithImage_PrependsImgTagToFront()
    {
        _flashcards.Setup(r => r.GetByUserIdAsync(_userId, default)).ReturnsAsync(new[]
        {
            new Flashcard { FlashcardId = Guid.NewGuid(), CardType = "occlusion", ImageUrl = "https://img/x.png", Front = "Identify", Back = "" },
        });
        IReadOnlyList<AnkiExportCard>? capturedCards = null;
        _ankiExport.Setup(a => a.BuildPackage(It.IsAny<string>(), It.IsAny<IReadOnlyList<AnkiExportCard>>()))
            .Callback<string, IReadOnlyList<AnkiExportCard>>((_, cards) => capturedCards = cards)
            .Returns(new byte[] { 1 });

        await _handler.Handle(new ExportFlashcardsToAnkiQuery(_userId), default);

        Assert.Contains("<img src=\"https://img/x.png\">", capturedCards![0].Front);
    }

    [Fact]
    public async Task Handle_AttachesSrsDataWhenAvailable()
    {
        var cardId = Guid.NewGuid();
        _flashcards.Setup(r => r.GetByUserIdAsync(_userId, default)).ReturnsAsync(new[] { new Flashcard { FlashcardId = cardId, Front = "F", Back = "B" } });
        _srs.Setup(r => r.GetByUserIdAsync(_userId, default)).ReturnsAsync(new[]
        {
            new FlashcardSrsData { UserId = _userId, FlashcardId = cardId, State = 2, ScheduledDays = 5, Reps = 3, Lapses = 1 },
        });
        IReadOnlyList<AnkiExportCard>? capturedCards = null;
        _ankiExport.Setup(a => a.BuildPackage(It.IsAny<string>(), It.IsAny<IReadOnlyList<AnkiExportCard>>()))
            .Callback<string, IReadOnlyList<AnkiExportCard>>((_, cards) => capturedCards = cards)
            .Returns(new byte[] { 1 });

        await _handler.Handle(new ExportFlashcardsToAnkiQuery(_userId), default);

        Assert.Equal(2, capturedCards![0].SrsState);
        Assert.Equal(3, capturedCards[0].Reps);
    }

    [Fact]
    public async Task Handle_DeckFileNameSanitizesInvalidCharacters()
    {
        var courseId = Guid.NewGuid();
        _courses.Setup(r => r.GetByIdAsync(courseId, default)).ReturnsAsync(new Course { CourseId = courseId, UserId = _userId, CourseName = "CS/101:Intro" });
        _documents.Setup(r => r.GetDocumentCourseMapAsync(_userId, default)).ReturnsAsync(new Dictionary<Guid, Guid>());
        _videos.Setup(r => r.GetVideoCourseMapAsync(_userId, default)).ReturnsAsync(new Dictionary<Guid, Guid>());
        var docId = Guid.NewGuid();
        _flashcards.Setup(r => r.GetByUserIdAsync(_userId, default)).ReturnsAsync(new[] { new Flashcard { FlashcardId = Guid.NewGuid(), DocumentId = docId, Front = "F", Back = "B" } });
        _documents.Setup(r => r.GetDocumentCourseMapAsync(_userId, default)).ReturnsAsync(new Dictionary<Guid, Guid> { [docId] = courseId });

        var result = await _handler.Handle(new ExportFlashcardsToAnkiQuery(_userId, courseId), default);

        Assert.True(result.IsSuccess);
        Assert.DoesNotContain("/", result.Data!.FileName);
        Assert.EndsWith(".apkg", result.Data.FileName);
    }

    [Fact]
    public async Task Handle_ReturnsCorrectCardCount()
    {
        _flashcards.Setup(r => r.GetByUserIdAsync(_userId, default)).ReturnsAsync(new[]
        {
            new Flashcard { FlashcardId = Guid.NewGuid(), Front = "A", Back = "B" },
            new Flashcard { FlashcardId = Guid.NewGuid(), Front = "C", Back = "D" },
        });

        var result = await _handler.Handle(new ExportFlashcardsToAnkiQuery(_userId), default);

        Assert.Equal(2, result.Data!.CardCount);
    }
}
