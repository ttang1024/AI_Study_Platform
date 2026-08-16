using System.Linq.Expressions;
using Moq;
using StudyPlatform.Application.Documents.Queries;
using StudyPlatform.Domain.Entities;
using StudyPlatform.Domain.Interfaces;
using Xunit;

namespace StudyPlatform.Tests.Documents;

public class GetQuizSubmissionQueryHandlerTests
{
    private readonly Mock<IUnitOfWork> _uow = new();
    private readonly Mock<IQuizSubmissionRepository> _submissions = new();
    private readonly GetQuizSubmissionQueryHandler _handler;
    private readonly Guid _userId = Guid.NewGuid();
    private readonly Guid _documentId = Guid.NewGuid();

    public GetQuizSubmissionQueryHandlerTests()
    {
        _uow.Setup(u => u.QuizSubmissions).Returns(_submissions.Object);
        _handler = new GetQuizSubmissionQueryHandler(_uow.Object);
    }

    [Fact]
    public async Task Handle_NoSubmission_ReturnsSuccessWithNullData()
    {
        _submissions.Setup(r => r.GetByDocumentAndUserAsync(_documentId, _userId, default)).ReturnsAsync((QuizSubmission?)null);

        var result = await _handler.Handle(new GetQuizSubmissionQuery(_documentId, _userId), default);

        Assert.True(result.IsSuccess);
        Assert.Null(result.Data);
    }

    [Fact]
    public async Task Handle_HasSubmission_ReturnsMappedDto()
    {
        var submission = new QuizSubmission
        {
            SubmissionId = Guid.NewGuid(),
            DocumentId = _documentId,
            UserId = _userId,
            AnswersJson = "{}",
            Score = 8,
            Total = 10,
            SubmittedAt = DateTime.UtcNow,
        };
        _submissions.Setup(r => r.GetByDocumentAndUserAsync(_documentId, _userId, default)).ReturnsAsync(submission);

        var result = await _handler.Handle(new GetQuizSubmissionQuery(_documentId, _userId), default);

        Assert.True(result.IsSuccess);
        Assert.NotNull(result.Data);
        Assert.Equal(8, result.Data!.Score);
    }
}

public class GetAllQuizSubmissionsPagedQueryHandlerTests
{
    private readonly Mock<IUnitOfWork> _uow = new();
    private readonly Mock<IQuizSubmissionRepository> _submissions = new();
    private readonly GetAllQuizSubmissionsPagedQueryHandler _handler;
    private readonly Guid _userId = Guid.NewGuid();

    public GetAllQuizSubmissionsPagedQueryHandlerTests()
    {
        _uow.Setup(u => u.QuizSubmissions).Returns(_submissions.Object);
        _handler = new GetAllQuizSubmissionsPagedQueryHandler(_uow.Object);
    }

    [Fact]
    public async Task Handle_ReturnsPagedResult()
    {
        var submission = new QuizSubmission { SubmissionId = Guid.NewGuid(), UserId = _userId, AnswersJson = "{}", SubmittedAt = DateTime.UtcNow };
        _submissions.Setup(r => r.GetPagedByUserAsync(_userId, 1, 20, default)).ReturnsAsync((new[] { submission }, 1));

        var result = await _handler.Handle(new GetAllQuizSubmissionsPagedQuery(_userId, 1, 20), default);

        Assert.True(result.IsSuccess);
        Assert.Equal(1, result.Data!.TotalCount);
    }
}

public class GetQuizSubmissionCoverageQueryHandlerTests
{
    private readonly Mock<IUnitOfWork> _uow = new();
    private readonly Mock<IQuizSubmissionRepository> _submissions = new();
    private readonly GetQuizSubmissionCoverageQueryHandler _handler;
    private readonly Guid _userId = Guid.NewGuid();

    public GetQuizSubmissionCoverageQueryHandlerTests()
    {
        _uow.Setup(u => u.QuizSubmissions).Returns(_submissions.Object);
        _handler = new GetQuizSubmissionCoverageQueryHandler(_uow.Object);
    }

    [Fact]
    public async Task Handle_ReturnsCoverage()
    {
        var docId = Guid.NewGuid();
        var videoId = Guid.NewGuid();
        _submissions.Setup(r => r.GetCoverageByUserAsync(_userId, default)).ReturnsAsync((new[] { docId }, new[] { videoId }));

        var result = await _handler.Handle(new GetQuizSubmissionCoverageQuery(_userId), default);

        Assert.True(result.IsSuccess);
        Assert.Contains(docId, result.Data!.DocumentIds);
        Assert.Contains(videoId, result.Data.VideoIds);
    }
}

public class GetPendingQuizMaterialsQueryHandlerTests
{
    private readonly Mock<IUnitOfWork> _uow = new();
    private readonly Mock<IQuizSubmissionRepository> _submissions = new();
    private readonly Mock<ICourseRepository> _courses = new();
    private readonly Mock<IDocumentRepository> _documents = new();
    private readonly Mock<IVideoRepository> _videos = new();
    private readonly GetPendingQuizMaterialsQueryHandler _handler;
    private readonly Guid _userId = Guid.NewGuid();

    public GetPendingQuizMaterialsQueryHandlerTests()
    {
        _uow.Setup(u => u.QuizSubmissions).Returns(_submissions.Object);
        _uow.Setup(u => u.Courses).Returns(_courses.Object);
        _uow.Setup(u => u.Documents).Returns(_documents.Object);
        _uow.Setup(u => u.Videos).Returns(_videos.Object);
        _submissions.Setup(r => r.GetCoverageByUserAsync(_userId, default)).ReturnsAsync((Array.Empty<Guid>(), Array.Empty<Guid>()));
        _courses.Setup(r => r.FindAsNoTrackingAsync(It.IsAny<Expression<Func<Course, bool>>>(), default)).ReturnsAsync(Array.Empty<Course>());
        _documents.Setup(r => r.FindAsNoTrackingAsync(It.IsAny<Expression<Func<Document, bool>>>(), default)).ReturnsAsync(Array.Empty<Document>());
        _videos.Setup(r => r.FindAsNoTrackingAsync(It.IsAny<Expression<Func<Video, bool>>>(), default)).ReturnsAsync(Array.Empty<Video>());
        _handler = new GetPendingQuizMaterialsQueryHandler(_uow.Object);
    }

    [Fact]
    public async Task Handle_ExcludesDocumentsWithSubmissions()
    {
        var coveredDocId = Guid.NewGuid();
        var pendingDocId = Guid.NewGuid();
        _submissions.Setup(r => r.GetCoverageByUserAsync(_userId, default)).ReturnsAsync((new[] { coveredDocId }, Array.Empty<Guid>()));
        _documents.Setup(r => r.FindAsNoTrackingAsync(It.IsAny<Expression<Func<Document, bool>>>(), default))
            .ReturnsAsync(new[] { new Document { DocumentId = pendingDocId, UserId = _userId, FileName = "Pending.pdf" } });

        var result = await _handler.Handle(new GetPendingQuizMaterialsQuery(_userId), default);

        var item = Assert.Single(result.Data!);
        Assert.Equal(pendingDocId, item.Id);
    }

    [Fact]
    public async Task Handle_IncludesPendingVideos()
    {
        var videoId = Guid.NewGuid();
        _videos.Setup(r => r.FindAsNoTrackingAsync(It.IsAny<Expression<Func<Video, bool>>>(), default))
            .ReturnsAsync(new[] { new Video { VideoId = videoId, UserId = _userId, Title = "Lecture", ExternalVideoId = "abc" } });

        var result = await _handler.Handle(new GetPendingQuizMaterialsQuery(_userId), default);

        var item = Assert.Single(result.Data!);
        Assert.Equal("video", item.Kind);
        Assert.Equal(videoId, item.Id);
    }
}

public class GetGeneratedQuizMaterialsQueryHandlerTests
{
    private readonly Mock<IUnitOfWork> _uow = new();
    private readonly Mock<IQuizRepository> _quizzes = new();
    private readonly Mock<IQuizSubmissionRepository> _submissions = new();
    private readonly Mock<ICourseRepository> _courses = new();
    private readonly Mock<IDocumentRepository> _documents = new();
    private readonly Mock<IVideoRepository> _videos = new();
    private readonly GetGeneratedQuizMaterialsQueryHandler _handler;
    private readonly Guid _userId = Guid.NewGuid();

    public GetGeneratedQuizMaterialsQueryHandlerTests()
    {
        _uow.Setup(u => u.Quizzes).Returns(_quizzes.Object);
        _uow.Setup(u => u.QuizSubmissions).Returns(_submissions.Object);
        _uow.Setup(u => u.Courses).Returns(_courses.Object);
        _uow.Setup(u => u.Documents).Returns(_documents.Object);
        _uow.Setup(u => u.Videos).Returns(_videos.Object);
        _quizzes.Setup(r => r.FindAsNoTrackingAsync(It.IsAny<Expression<Func<Quiz, bool>>>(), default)).ReturnsAsync(Array.Empty<Quiz>());
        _submissions.Setup(r => r.GetCoverageByUserAsync(_userId, default)).ReturnsAsync((Array.Empty<Guid>(), Array.Empty<Guid>()));
        _courses.Setup(r => r.FindAsNoTrackingAsync(It.IsAny<Expression<Func<Course, bool>>>(), default)).ReturnsAsync(Array.Empty<Course>());
        _documents.Setup(r => r.FindAsNoTrackingAsync(It.IsAny<Expression<Func<Document, bool>>>(), default)).ReturnsAsync(Array.Empty<Document>());
        _videos.Setup(r => r.FindAsNoTrackingAsync(It.IsAny<Expression<Func<Video, bool>>>(), default)).ReturnsAsync(Array.Empty<Video>());
        _handler = new GetGeneratedQuizMaterialsQueryHandler(_uow.Object);
    }

    [Fact]
    public async Task Handle_DocumentWithGeneratedQuizButNoSubmission_IsIncluded()
    {
        var docId = Guid.NewGuid();
        _quizzes.Setup(r => r.FindAsNoTrackingAsync(It.IsAny<Expression<Func<Quiz, bool>>>(), default))
            .ReturnsAsync(new[] { new Quiz { QuizId = Guid.NewGuid(), UserId = _userId, DocumentId = docId, SourceType = "document", Question = "Q", OptionsJson = "[]", CorrectAnswer = "A" } });
        _documents.Setup(r => r.FindAsNoTrackingAsync(It.IsAny<Expression<Func<Document, bool>>>(), default))
            .ReturnsAsync(new[] { new Document { DocumentId = docId, UserId = _userId, FileName = "F.pdf" } });

        var result = await _handler.Handle(new GetGeneratedQuizMaterialsQuery(_userId), default);

        var item = Assert.Single(result.Data!);
        Assert.Equal(docId, item.Id);
    }

    [Fact]
    public async Task Handle_DocumentWithSubmission_IsExcluded()
    {
        var docId = Guid.NewGuid();
        _quizzes.Setup(r => r.FindAsNoTrackingAsync(It.IsAny<Expression<Func<Quiz, bool>>>(), default))
            .ReturnsAsync(new[] { new Quiz { QuizId = Guid.NewGuid(), UserId = _userId, DocumentId = docId, SourceType = "document", Question = "Q", OptionsJson = "[]", CorrectAnswer = "A" } });
        _submissions.Setup(r => r.GetCoverageByUserAsync(_userId, default)).ReturnsAsync((new[] { docId }, Array.Empty<Guid>()));

        var result = await _handler.Handle(new GetGeneratedQuizMaterialsQuery(_userId), default);

        Assert.Empty(result.Data!);
    }

    [Fact]
    public async Task Handle_VideoQuizByVideoIdWithoutSourceType_IsIncluded()
    {
        var videoId = Guid.NewGuid();
        _quizzes.Setup(r => r.FindAsNoTrackingAsync(It.IsAny<Expression<Func<Quiz, bool>>>(), default))
            .ReturnsAsync(new[] { new Quiz { QuizId = Guid.NewGuid(), UserId = _userId, VideoId = videoId, SourceType = "document", Question = "Q", OptionsJson = "[]", CorrectAnswer = "A" } });
        _videos.Setup(r => r.FindAsNoTrackingAsync(It.IsAny<Expression<Func<Video, bool>>>(), default))
            .ReturnsAsync(new[] { new Video { VideoId = videoId, UserId = _userId, Title = "V", ExternalVideoId = "x" } });

        var result = await _handler.Handle(new GetGeneratedQuizMaterialsQuery(_userId), default);

        var item = Assert.Single(result.Data!);
        Assert.Equal(videoId, item.Id);
        Assert.Equal("video", item.Kind);
    }
}
