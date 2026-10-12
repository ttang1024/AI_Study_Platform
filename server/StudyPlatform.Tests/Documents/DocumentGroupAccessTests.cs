using System.Linq.Expressions;
using Moq;
using StudyPlatform.Application.Documents.Queries;
using StudyPlatform.Application.Services;
using StudyPlatform.Domain.Entities;
using StudyPlatform.Domain.Interfaces;
using Xunit;
using StudyPlatform.Application.Common;

namespace StudyPlatform.Tests.Documents;

/// <summary>Covers the "not owned but shared with a study group" branch across the Documents query
/// handlers that gate access via <c>HasGroupAccessAsync</c> — the granted path was untested for several
/// of them.</summary>
public class DocumentGroupAccessTests
{
    private readonly Mock<IDocumentRepository> _documents = new();
    private readonly Mock<IQuizRepository> _quizzes = new();
    private readonly Mock<IFlashcardRepository> _flashcards = new();
    private readonly Mock<INoteRepository> _notes = new();
    private readonly Mock<IChatMessageRepository> _chatMessages = new();
    private readonly Mock<IBlobStorageService> _blobStorage = new();
    private readonly Mock<IStudyGroupSharedCourseRepository> _shared = new();
    private readonly Mock<IStudyGroupMemberRepository> _members = new();

    private readonly Guid _ownerId = Guid.NewGuid();
    private readonly Guid _viewerId = Guid.NewGuid();
    private readonly Guid _documentId = Guid.NewGuid();
    private readonly Guid _courseId = Guid.NewGuid();
    private readonly Guid _groupId = Guid.NewGuid();

    public DocumentGroupAccessTests()
    {
        var doc = new Document { DocumentId = _documentId, UserId = _ownerId, CourseId = _courseId, FileName = "F.pdf", BlobUrl = "b", ContentType = "application/pdf" };
        _documents.Setup(r => r.GetByIdAsync(_documentId, default)).ReturnsAsync(doc);
    }

    private void GrantGroupAccess()
    {
        _shared.Setup(r => r.FindAsync(It.IsAny<Expression<Func<StudyGroupSharedCourse, bool>>>(), default))
            .ReturnsAsync(new[] { new StudyGroupSharedCourse { GroupId = _groupId, CourseId = _courseId } });
        _members.Setup(r => r.ExistsAsync(It.IsAny<Expression<Func<StudyGroupMember, bool>>>(), default)).ReturnsAsync(true);
    }

    [Fact]
    public async Task GetDocumentByIdQuery_SharedViaGroup_ReturnsDocument()
    {
        GrantGroupAccess();
        var handler = new GetDocumentByIdQueryHandler(_documents.Object, new CourseAccess(_shared.Object, _members.Object));

        var result = await handler.Handle(new GetDocumentByIdQuery(_documentId, _viewerId), default);

        Assert.True(result.IsSuccess);
    }

    [Fact]
    public async Task GetDocumentQuizzesQuery_SharedViaGroup_ReturnsQuizzes()
    {
        GrantGroupAccess();
        _quizzes.Setup(r => r.GetByDocumentIdAsync(_documentId, default)).ReturnsAsync(Array.Empty<Quiz>());
        var handler = new GetDocumentQuizzesQueryHandler(_documents.Object, _quizzes.Object, new CourseAccess(_shared.Object, _members.Object));

        var result = await handler.Handle(new GetDocumentQuizzesQuery(_documentId, _viewerId), default);

        Assert.True(result.IsSuccess);
    }

    [Fact]
    public async Task GetDocumentFlashcardsQuery_SharedViaGroup_ReturnsFlashcards()
    {
        GrantGroupAccess();
        _flashcards.Setup(r => r.GetByDocumentIdAsync(_documentId, default)).ReturnsAsync(Array.Empty<Flashcard>());
        var handler = new GetDocumentFlashcardsQueryHandler(_documents.Object, _flashcards.Object, new CourseAccess(_shared.Object, _members.Object));

        var result = await handler.Handle(new GetDocumentFlashcardsQuery(_documentId, _viewerId), default);

        Assert.True(result.IsSuccess);
    }

    [Fact]
    public async Task GetDocumentFlashcardsQuery_NotSharedAtAll_ReturnsNotFound()
    {
        _shared.Setup(r => r.FindAsync(It.IsAny<Expression<Func<StudyGroupSharedCourse, bool>>>(), default))
            .ReturnsAsync(Array.Empty<StudyGroupSharedCourse>());
        var handler = new GetDocumentFlashcardsQueryHandler(_documents.Object, _flashcards.Object, new CourseAccess(_shared.Object, _members.Object));

        var result = await handler.Handle(new GetDocumentFlashcardsQuery(_documentId, _viewerId), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("DOCUMENT_NOT_FOUND", result.ErrorCode);
    }

    [Fact]
    public async Task GetDocumentNotesQuery_SharedViaGroup_ReturnsNotes()
    {
        GrantGroupAccess();
        _notes.Setup(r => r.GetByDocumentIdAsync(_documentId, default)).ReturnsAsync(Array.Empty<Note>());
        var handler = new GetDocumentNotesQueryHandler(_documents.Object, _notes.Object, new CourseAccess(_shared.Object, _members.Object));

        var result = await handler.Handle(new GetDocumentNotesQuery(_documentId, _viewerId), default);

        Assert.True(result.IsSuccess);
    }

    [Fact]
    public async Task GetAIChatHistoryQuery_SharedViaGroup_UsesOwnersConversationHistory()
    {
        GrantGroupAccess();
        _chatMessages.Setup(r => r.GetByDocumentIdAsync(_documentId, _ownerId, default)).ReturnsAsync(Array.Empty<ChatMessage>());
        var handler = new GetAIChatHistoryQueryHandler(_documents.Object, _chatMessages.Object, new CourseAccess(_shared.Object, _members.Object), _blobStorage.Object);

        var result = await handler.Handle(new GetAIChatHistoryQuery(_documentId, _viewerId), default);

        Assert.True(result.IsSuccess);
        _chatMessages.Verify(r => r.GetByDocumentIdAsync(_documentId, _ownerId, default), Times.Once);
    }

    [Fact]
    public async Task GetAIChatHistoryQuery_NotSharedAtAll_ReturnsNotFound()
    {
        _shared.Setup(r => r.FindAsync(It.IsAny<Expression<Func<StudyGroupSharedCourse, bool>>>(), default))
            .ReturnsAsync(Array.Empty<StudyGroupSharedCourse>());
        var handler = new GetAIChatHistoryQueryHandler(_documents.Object, _chatMessages.Object, new CourseAccess(_shared.Object, _members.Object), _blobStorage.Object);

        var result = await handler.Handle(new GetAIChatHistoryQuery(_documentId, _viewerId), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("DOCUMENT_NOT_FOUND", result.ErrorCode);
    }
}
