using System.Linq.Expressions;
using Moq;
using StudyPlatform.Application.Flashcards.Commands;
using StudyPlatform.Domain.Entities;
using StudyPlatform.Domain.Interfaces;
using Xunit;

namespace StudyPlatform.Tests.Flashcards;

public class GetFlashcardCoverageQueryHandlerTests
{
    private readonly Mock<IUnitOfWork> _uow = new();
    private readonly Mock<IFlashcardRepository> _flashcards = new();
    private readonly GetFlashcardCoverageQueryHandler _handler;
    private readonly Guid _userId = Guid.NewGuid();

    public GetFlashcardCoverageQueryHandlerTests()
    {
        _uow.Setup(u => u.Flashcards).Returns(_flashcards.Object);
        _handler = new GetFlashcardCoverageQueryHandler(_uow.Object);
    }

    [Fact]
    public async Task Handle_ReturnsDocumentAndVideoIds()
    {
        var docId = Guid.NewGuid();
        var videoId = Guid.NewGuid();
        _flashcards.Setup(r => r.GetCoverageByUserIdAsync(_userId, default))
            .ReturnsAsync((new[] { docId }, new[] { videoId }));

        var result = await _handler.Handle(new GetFlashcardCoverageQuery(_userId), default);

        Assert.True(result.IsSuccess);
        Assert.Contains(docId, result.Data!.DocumentIds);
        Assert.Contains(videoId, result.Data.VideoIds);
    }
}

public class GetPendingFlashcardMaterialsQueryHandlerTests
{
    private readonly Mock<IUnitOfWork> _uow = new();
    private readonly Mock<IFlashcardRepository> _flashcards = new();
    private readonly Mock<ICourseRepository> _courses = new();
    private readonly Mock<IDocumentRepository> _documents = new();
    private readonly Mock<IVideoRepository> _videos = new();
    private readonly GetPendingFlashcardMaterialsQueryHandler _handler;
    private readonly Guid _userId = Guid.NewGuid();

    public GetPendingFlashcardMaterialsQueryHandlerTests()
    {
        _uow.Setup(u => u.Flashcards).Returns(_flashcards.Object);
        _uow.Setup(u => u.Courses).Returns(_courses.Object);
        _uow.Setup(u => u.Documents).Returns(_documents.Object);
        _uow.Setup(u => u.Videos).Returns(_videos.Object);
        _flashcards.Setup(r => r.GetCoverageByUserIdAsync(_userId, default)).ReturnsAsync((Array.Empty<Guid>(), Array.Empty<Guid>()));
        _courses.Setup(r => r.FindAsync(It.IsAny<Expression<Func<Course, bool>>>(), default)).ReturnsAsync(Array.Empty<Course>());
        _documents.Setup(r => r.FindAsync(It.IsAny<Expression<Func<Document, bool>>>(), default)).ReturnsAsync(Array.Empty<Document>());
        _videos.Setup(r => r.FindAsync(It.IsAny<Expression<Func<Video, bool>>>(), default)).ReturnsAsync(Array.Empty<Video>());
        _handler = new GetPendingFlashcardMaterialsQueryHandler(_uow.Object);
    }

    [Fact]
    public async Task Handle_ExcludesDocumentsAndVideosThatAlreadyHaveCards()
    {
        var coveredDocId = Guid.NewGuid();
        var pendingDocId = Guid.NewGuid();
        _flashcards.Setup(r => r.GetCoverageByUserIdAsync(_userId, default)).ReturnsAsync((new[] { coveredDocId }, Array.Empty<Guid>()));
        _documents.Setup(r => r.FindAsync(It.IsAny<Expression<Func<Document, bool>>>(), default))
            .ReturnsAsync(new[] { new Document { DocumentId = pendingDocId, UserId = _userId, FileName = "Pending.pdf" } });

        var result = await _handler.Handle(new GetPendingFlashcardMaterialsQuery(_userId), default);

        var item = Assert.Single(result.Data!);
        Assert.Equal(pendingDocId, item.Id);
        Assert.Equal("document", item.Kind);
    }

    [Fact]
    public async Task Handle_AttachesCourseNameAndColor()
    {
        var courseId = Guid.NewGuid();
        var docId = Guid.NewGuid();
        _courses.Setup(r => r.FindAsync(It.IsAny<Expression<Func<Course, bool>>>(), default))
            .ReturnsAsync(new[] { new Course { CourseId = courseId, UserId = _userId, CourseName = "Algorithms", CourseColor = "#123456" } });
        _documents.Setup(r => r.FindAsync(It.IsAny<Expression<Func<Document, bool>>>(), default))
            .ReturnsAsync(new[] { new Document { DocumentId = docId, UserId = _userId, CourseId = courseId, FileName = "F.pdf" } });

        var result = await _handler.Handle(new GetPendingFlashcardMaterialsQuery(_userId), default);

        var item = result.Data!.Single();
        Assert.Equal("Algorithms", item.CourseName);
        Assert.Equal("#123456", item.CourseColor);
    }

    [Fact]
    public async Task Handle_MissingCourse_UsesFallbackNameAndColor()
    {
        var docId = Guid.NewGuid();
        _documents.Setup(r => r.FindAsync(It.IsAny<Expression<Func<Document, bool>>>(), default))
            .ReturnsAsync(new[] { new Document { DocumentId = docId, UserId = _userId, CourseId = Guid.NewGuid(), FileName = "F.pdf" } });

        var result = await _handler.Handle(new GetPendingFlashcardMaterialsQuery(_userId), default);

        var item = result.Data!.Single();
        Assert.Equal(string.Empty, item.CourseName);
        Assert.Equal("#a1a1aa", item.CourseColor);
    }

    [Fact]
    public async Task Handle_IncludesPendingVideos()
    {
        var videoId = Guid.NewGuid();
        _videos.Setup(r => r.FindAsync(It.IsAny<Expression<Func<Video, bool>>>(), default))
            .ReturnsAsync(new[] { new Video { VideoId = videoId, UserId = _userId, Title = "Lecture 1", ExternalVideoId = "abc" } });

        var result = await _handler.Handle(new GetPendingFlashcardMaterialsQuery(_userId), default);

        var item = result.Data!.Single();
        Assert.Equal("video", item.Kind);
        Assert.Equal("Lecture 1", item.Name);
    }

    [Fact]
    public async Task Handle_ResultsOrderedByCreatedAtDescending()
    {
        var older = new Document { DocumentId = Guid.NewGuid(), UserId = _userId, FileName = "Old.pdf", CreatedAt = DateTime.UtcNow.AddDays(-5) };
        var newer = new Document { DocumentId = Guid.NewGuid(), UserId = _userId, FileName = "New.pdf", CreatedAt = DateTime.UtcNow };
        _documents.Setup(r => r.FindAsync(It.IsAny<Expression<Func<Document, bool>>>(), default)).ReturnsAsync(new[] { older, newer });

        var result = await _handler.Handle(new GetPendingFlashcardMaterialsQuery(_userId), default);

        Assert.Equal("New.pdf", result.Data!.First().Name);
    }
}
