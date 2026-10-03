using System.Linq.Expressions;
using Microsoft.Extensions.Options;
using Moq;
using StudyPlatform.Application.Documents.Queries;
using StudyPlatform.Application.Services;
using StudyPlatform.Application.Settings;
using StudyPlatform.Domain.Entities;
using StudyPlatform.Domain.Interfaces;
using Xunit;

namespace StudyPlatform.Tests.Documents;

public class GetDocumentsByCourseQueryHandlerTests
{
    private readonly Mock<IUnitOfWork> _uow = new();
    private readonly Mock<ICourseRepository> _courses = new();
    private readonly Mock<IDocumentRepository> _documents = new();
    private readonly Mock<IStudyGroupSharedCourseRepository> _shared = new();
    private readonly Mock<IStudyGroupMemberRepository> _members = new();
    private readonly GetDocumentsByCourseQueryHandler _handler;
    private readonly Guid _userId = Guid.NewGuid();
    private readonly Guid _courseId = Guid.NewGuid();

    public GetDocumentsByCourseQueryHandlerTests()
    {
        _uow.Setup(u => u.Courses).Returns(_courses.Object);
        _uow.Setup(u => u.Documents).Returns(_documents.Object);
        _uow.Setup(u => u.StudyGroupSharedCourses).Returns(_shared.Object);
        _uow.Setup(u => u.StudyGroupMembers).Returns(_members.Object);
        _handler = new GetDocumentsByCourseQueryHandler(_uow.Object);
    }

    [Fact]
    public async Task Handle_CourseNotFound_ReturnsFailure()
    {
        _courses.Setup(r => r.GetByIdAsync(_courseId, default)).ReturnsAsync((Course?)null);

        var result = await _handler.Handle(new GetDocumentsByCourseQuery(_courseId, _userId), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("COURSE_NOT_FOUND", result.ErrorCode);
    }

    [Fact]
    public async Task Handle_OwnedCourse_ReturnsDocuments()
    {
        _courses.Setup(r => r.GetByIdAsync(_courseId, default)).ReturnsAsync(new Course { CourseId = _courseId, UserId = _userId });
        _documents.Setup(r => r.GetByCourseIdAsync(_courseId, _userId, default))
            .ReturnsAsync(new[] { new Document { DocumentId = Guid.NewGuid(), UserId = _userId, CourseId = _courseId, FileName = "F.pdf", BlobUrl = "b", ContentType = "application/pdf" } });

        var result = await _handler.Handle(new GetDocumentsByCourseQuery(_courseId, _userId), default);

        Assert.True(result.IsSuccess);
        Assert.Single(result.Data!);
    }

    [Fact]
    public async Task Handle_NotOwnedNoGroupAccess_ReturnsFailure()
    {
        _courses.Setup(r => r.GetByIdAsync(_courseId, default)).ReturnsAsync(new Course { CourseId = _courseId, UserId = Guid.NewGuid() });
        _shared.Setup(r => r.FindAsync(It.IsAny<Expression<Func<StudyGroupSharedCourse, bool>>>(), default)).ReturnsAsync(Array.Empty<StudyGroupSharedCourse>());

        var result = await _handler.Handle(new GetDocumentsByCourseQuery(_courseId, _userId), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("COURSE_NOT_FOUND", result.ErrorCode);
    }

    [Fact]
    public async Task Handle_NotOwnedWithGroupAccess_ReturnsDocuments()
    {
        var groupId = Guid.NewGuid();
        _courses.Setup(r => r.GetByIdAsync(_courseId, default)).ReturnsAsync(new Course { CourseId = _courseId, UserId = Guid.NewGuid() });
        _shared.Setup(r => r.FindAsync(It.IsAny<Expression<Func<StudyGroupSharedCourse, bool>>>(), default))
            .ReturnsAsync(new[] { new StudyGroupSharedCourse { GroupId = groupId, CourseId = _courseId } });
        _members.Setup(r => r.ExistsAsync(It.IsAny<Expression<Func<StudyGroupMember, bool>>>(), default)).ReturnsAsync(true);
        _documents.Setup(r => r.GetByCourseIdAsync(_courseId, default))
            .ReturnsAsync(new[] { new Document { DocumentId = Guid.NewGuid(), UserId = Guid.NewGuid(), CourseId = _courseId, FileName = "F.pdf", BlobUrl = "b", ContentType = "application/pdf" } });

        var result = await _handler.Handle(new GetDocumentsByCourseQuery(_courseId, _userId), default);

        Assert.True(result.IsSuccess);
        Assert.Single(result.Data!);
    }
}

public class GetDocumentNotesQueryHandlerTests
{
    private readonly Mock<IUnitOfWork> _uow = new();
    private readonly Mock<IDocumentRepository> _documents = new();
    private readonly Mock<INoteRepository> _notes = new();
    private readonly Mock<IStudyGroupSharedCourseRepository> _shared = new();
    private readonly Mock<IStudyGroupMemberRepository> _members = new();
    private readonly GetDocumentNotesQueryHandler _handler;
    private readonly Guid _userId = Guid.NewGuid();
    private readonly Guid _documentId = Guid.NewGuid();

    public GetDocumentNotesQueryHandlerTests()
    {
        _uow.Setup(u => u.Documents).Returns(_documents.Object);
        _uow.Setup(u => u.Notes).Returns(_notes.Object);
        _uow.Setup(u => u.StudyGroupSharedCourses).Returns(_shared.Object);
        _uow.Setup(u => u.StudyGroupMembers).Returns(_members.Object);
        _handler = new GetDocumentNotesQueryHandler(_uow.Object);
    }

    [Fact]
    public async Task Handle_DocumentNotFound_ReturnsFailure()
    {
        _documents.Setup(r => r.GetByIdAsync(_documentId, default)).ReturnsAsync((Document?)null);

        var result = await _handler.Handle(new GetDocumentNotesQuery(_documentId, _userId), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("DOCUMENT_NOT_FOUND", result.ErrorCode);
    }

    [Fact]
    public async Task Handle_OwnedDocument_ReturnsNotes()
    {
        var doc = new Document { DocumentId = _documentId, UserId = _userId, CourseId = Guid.NewGuid(), FileName = "F.pdf", BlobUrl = "b", ContentType = "application/pdf" };
        _documents.Setup(r => r.GetByIdAsync(_documentId, default)).ReturnsAsync(doc);
        _notes.Setup(r => r.GetByDocumentIdAsync(_documentId, default))
            .ReturnsAsync(new[] { new Note { NoteId = Guid.NewGuid(), DocumentId = _documentId, UserId = _userId, Content = "hi" } });

        var result = await _handler.Handle(new GetDocumentNotesQuery(_documentId, _userId), default);

        Assert.True(result.IsSuccess);
        Assert.Single(result.Data!);
    }

    [Fact]
    public async Task Handle_NotOwnedNoGroupAccess_ReturnsFailure()
    {
        var doc = new Document { DocumentId = _documentId, UserId = Guid.NewGuid(), CourseId = Guid.NewGuid(), FileName = "F.pdf", BlobUrl = "b", ContentType = "application/pdf" };
        _documents.Setup(r => r.GetByIdAsync(_documentId, default)).ReturnsAsync(doc);
        _shared.Setup(r => r.FindAsync(It.IsAny<Expression<Func<StudyGroupSharedCourse, bool>>>(), default)).ReturnsAsync(Array.Empty<StudyGroupSharedCourse>());

        var result = await _handler.Handle(new GetDocumentNotesQuery(_documentId, _userId), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("DOCUMENT_NOT_FOUND", result.ErrorCode);
    }
}

public class GetAIChatHistoryQueryHandlerTests
{
    private readonly Mock<IUnitOfWork> _uow = new();
    private readonly Mock<IDocumentRepository> _documents = new();
    private readonly Mock<IChatMessageRepository> _chatMessages = new();
    private readonly Mock<IStudyGroupSharedCourseRepository> _shared = new();
    private readonly Mock<IStudyGroupMemberRepository> _members = new();
    private readonly Mock<IBlobStorageService> _blobStorage = new();
    private readonly GetAIChatHistoryQueryHandler _handler;
    private readonly Guid _userId = Guid.NewGuid();
    private readonly Guid _documentId = Guid.NewGuid();

    public GetAIChatHistoryQueryHandlerTests()
    {
        _uow.Setup(u => u.Documents).Returns(_documents.Object);
        _uow.Setup(u => u.ChatMessages).Returns(_chatMessages.Object);
        _uow.Setup(u => u.StudyGroupSharedCourses).Returns(_shared.Object);
        _uow.Setup(u => u.StudyGroupMembers).Returns(_members.Object);
        _handler = new GetAIChatHistoryQueryHandler(_uow.Object, _blobStorage.Object);
    }

    [Fact]
    public async Task Handle_DocumentNotFound_ReturnsFailure()
    {
        _documents.Setup(r => r.GetByIdAsync(_documentId, default)).ReturnsAsync((Document?)null);

        var result = await _handler.Handle(new GetAIChatHistoryQuery(_documentId, _userId), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("DOCUMENT_NOT_FOUND", result.ErrorCode);
    }

    [Fact]
    public async Task Handle_OwnedDocument_ReturnsMessages()
    {
        var doc = new Document { DocumentId = _documentId, UserId = _userId, CourseId = Guid.NewGuid(), FileName = "F.pdf", BlobUrl = "b", ContentType = "application/pdf" };
        _documents.Setup(r => r.GetByIdAsync(_documentId, default)).ReturnsAsync(doc);
        _chatMessages.Setup(r => r.GetByDocumentIdAsync(_documentId, _userId, default))
            .ReturnsAsync(new[] { new ChatMessage { MessageId = Guid.NewGuid(), DocumentId = _documentId, UserId = _userId, Role = "user", Content = "hi", CreatedAt = DateTime.UtcNow } });

        var result = await _handler.Handle(new GetAIChatHistoryQuery(_documentId, _userId), default);

        Assert.True(result.IsSuccess);
        Assert.Single(result.Data!);
    }
}

public class GetDocumentDownloadUrlQueryHandlerTests
{
    private readonly Mock<IUnitOfWork> _uow = new();
    private readonly Mock<IDocumentRepository> _documents = new();
    private readonly Mock<IBlobStorageService> _blobStorage = new();
    private readonly Mock<IAppCache> _cache = new();
    private readonly GetDocumentDownloadUrlQueryHandler _handler;
    private readonly Guid _userId = Guid.NewGuid();
    private readonly Guid _documentId = Guid.NewGuid();

    public GetDocumentDownloadUrlQueryHandlerTests()
    {
        _uow.Setup(u => u.Documents).Returns(_documents.Object);
        _cache.Setup(c => c.GetOrCreateAsync(
                It.IsAny<string>(), It.IsAny<Func<CancellationToken, Task<string>>>(),
                It.IsAny<TimeSpan>(), It.IsAny<CancellationToken>()))
            .Returns((string _, Func<CancellationToken, Task<string>> factory, TimeSpan _, CancellationToken ct) => factory(ct));
        _handler = new GetDocumentDownloadUrlQueryHandler(_uow.Object, _blobStorage.Object, _cache.Object, Options.Create(new CacheOptions()));
    }

    [Fact]
    public async Task Handle_DocumentNotFound_ReturnsFailure()
    {
        _documents.Setup(r => r.GetByIdAsync(_documentId, default)).ReturnsAsync((Document?)null);

        var result = await _handler.Handle(new GetDocumentDownloadUrlQuery(_documentId, _userId), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("DOCUMENT_NOT_FOUND", result.ErrorCode);
    }

    [Fact]
    public async Task Handle_NotOwned_ReturnsFailure()
    {
        var doc = new Document { DocumentId = _documentId, UserId = Guid.NewGuid(), CourseId = Guid.NewGuid(), FileName = "F.pdf", BlobUrl = "b", ContentType = "application/pdf" };
        _documents.Setup(r => r.GetByIdAsync(_documentId, default)).ReturnsAsync(doc);

        var result = await _handler.Handle(new GetDocumentDownloadUrlQuery(_documentId, _userId), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("DOCUMENT_NOT_FOUND", result.ErrorCode);
    }

    [Fact]
    public async Task Handle_Owned_ReturnsSasUrl()
    {
        var doc = new Document { DocumentId = _documentId, UserId = _userId, CourseId = Guid.NewGuid(), FileName = "F.pdf", BlobUrl = "blob://x", ContentType = "application/pdf" };
        _documents.Setup(r => r.GetByIdAsync(_documentId, default)).ReturnsAsync(doc);
        _blobStorage.Setup(b => b.GetSasUrlAsync("blob://x", 60, default)).ReturnsAsync("https://sas-url");

        var result = await _handler.Handle(new GetDocumentDownloadUrlQuery(_documentId, _userId), default);

        Assert.True(result.IsSuccess);
        Assert.Equal("https://sas-url", result.Data);
    }
}

public class GetDocumentFlashcardsQueryHandlerTests
{
    private readonly Mock<IUnitOfWork> _uow = new();
    private readonly Mock<IDocumentRepository> _documents = new();
    private readonly Mock<IFlashcardRepository> _flashcards = new();
    private readonly Mock<IStudyGroupSharedCourseRepository> _shared = new();
    private readonly Mock<IStudyGroupMemberRepository> _members = new();
    private readonly GetDocumentFlashcardsQueryHandler _handler;
    private readonly Guid _userId = Guid.NewGuid();
    private readonly Guid _documentId = Guid.NewGuid();

    public GetDocumentFlashcardsQueryHandlerTests()
    {
        _uow.Setup(u => u.Documents).Returns(_documents.Object);
        _uow.Setup(u => u.Flashcards).Returns(_flashcards.Object);
        _uow.Setup(u => u.StudyGroupSharedCourses).Returns(_shared.Object);
        _uow.Setup(u => u.StudyGroupMembers).Returns(_members.Object);
        _handler = new GetDocumentFlashcardsQueryHandler(_uow.Object);
    }

    [Fact]
    public async Task Handle_DocumentNotFound_ReturnsFailure()
    {
        _documents.Setup(r => r.GetByIdAsync(_documentId, default)).ReturnsAsync((Document?)null);

        var result = await _handler.Handle(new GetDocumentFlashcardsQuery(_documentId, _userId), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("DOCUMENT_NOT_FOUND", result.ErrorCode);
    }

    [Fact]
    public async Task Handle_OwnedDocument_ReturnsFlashcards()
    {
        var doc = new Document { DocumentId = _documentId, UserId = _userId, CourseId = Guid.NewGuid(), FileName = "F.pdf", BlobUrl = "b", ContentType = "application/pdf" };
        _documents.Setup(r => r.GetByIdAsync(_documentId, default)).ReturnsAsync(doc);
        _flashcards.Setup(r => r.GetByDocumentIdAsync(_documentId, default))
            .ReturnsAsync(new[] { new Flashcard { FlashcardId = Guid.NewGuid(), DocumentId = _documentId, Front = "Q", Back = "A" } });

        var result = await _handler.Handle(new GetDocumentFlashcardsQuery(_documentId, _userId), default);

        Assert.True(result.IsSuccess);
        Assert.Single(result.Data!);
    }
}
