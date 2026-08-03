using System.Linq.Expressions;
using Moq;
using StudyPlatform.Application.LibraryTags.Commands;
using StudyPlatform.Application.LibraryTags.DTOs;
using StudyPlatform.Domain.Entities;
using StudyPlatform.Domain.Interfaces;
using Xunit;

namespace StudyPlatform.Tests.LibraryTags;

public class AssignLibraryTagCommandHandlerTests
{
    private readonly Mock<IUnitOfWork> _uow = new();
    private readonly Mock<ILibraryTagRepository> _tags = new();
    private readonly Mock<IDocumentRepository> _documents = new();
    private readonly Mock<IVideoRepository> _videos = new();
    private readonly AssignLibraryTagCommandHandler _handler;

    private readonly Guid _userId = Guid.NewGuid();
    private readonly Guid _tagId = Guid.NewGuid();

    public AssignLibraryTagCommandHandlerTests()
    {
        _uow.Setup(u => u.LibraryTags).Returns(_tags.Object);
        _uow.Setup(u => u.Documents).Returns(_documents.Object);
        _uow.Setup(u => u.Videos).Returns(_videos.Object);
        _uow.Setup(u => u.SaveChangesAsync(default)).ReturnsAsync(1);

        NoDocuments();
        NoVideos();

        _handler = new AssignLibraryTagCommandHandler(_uow.Object);
    }

    private LibraryTag MakeTag(Guid? owner = null) => new()
    {
        LibraryTagId = _tagId,
        UserId = owner ?? _userId,
        Name = "Exam prep",
        Kind = LibraryTagKinds.Collection,
    };

    private void OwnsTag() => _tags.Setup(r => r.GetByIdAsync(_tagId, default)).ReturnsAsync(MakeTag());

    private void NoDocuments() => _documents
        .Setup(r => r.FindAsNoTrackingAsync(It.IsAny<Expression<Func<Document, bool>>>(), default))
        .ReturnsAsync(Array.Empty<Document>());

    private void NoVideos() => _videos
        .Setup(r => r.FindAsNoTrackingAsync(It.IsAny<Expression<Func<Video, bool>>>(), default))
        .ReturnsAsync(Array.Empty<Video>());

    /// <summary>
    /// Returns only the documents whose owner matches, so the handler's ownership filter is exercised
    /// against a repository that behaves like the real one.
    /// </summary>
    private void DocumentsOwnedBy(Guid owner, params Guid[] ids) => _documents
        .Setup(r => r.FindAsNoTrackingAsync(It.IsAny<Expression<Func<Document, bool>>>(), default))
        .ReturnsAsync((Expression<Func<Document, bool>> predicate, CancellationToken _) =>
            ids.Select(id => new Document { DocumentId = id, UserId = owner })
               .Where(predicate.Compile())
               .ToList());

    [Fact]
    public async Task Handle_AssignsOwnedItems()
    {
        OwnsTag();
        var docId = Guid.NewGuid();
        DocumentsOwnedBy(_userId, docId);
        _tags.Setup(r => r.AssignAsync(_tagId, It.IsAny<IReadOnlyCollection<(string, Guid)>>(), default))
            .ReturnsAsync(1);

        var result = await _handler.Handle(new AssignLibraryTagCommand(
            _userId, _tagId, new[] { new LibraryItemRef("document", docId) }, Assign: true), default);

        Assert.True(result.IsSuccess);
        Assert.Equal(1, result.Data!.Changed);
    }

    /// <summary>
    /// The ids come from the client. A document belonging to somebody else must not be taggable —
    /// otherwise a collection becomes a way to enumerate another user's library.
    /// </summary>
    [Fact]
    public async Task Handle_RefusesItemsTheUserDoesNotOwn()
    {
        OwnsTag();
        DocumentsOwnedBy(Guid.NewGuid(), Guid.NewGuid());

        var result = await _handler.Handle(new AssignLibraryTagCommand(
            _userId, _tagId, new[] { new LibraryItemRef("document", Guid.NewGuid()) }, Assign: true), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("NO_OWNED_ITEMS", result.ErrorCode);
        _tags.Verify(r => r.AssignAsync(It.IsAny<Guid>(), It.IsAny<IReadOnlyCollection<(string, Guid)>>(), default), Times.Never);
    }

    [Fact]
    public async Task Handle_RefusesATagBelongingToSomeoneElse()
    {
        _tags.Setup(r => r.GetByIdAsync(_tagId, default)).ReturnsAsync(MakeTag(owner: Guid.NewGuid()));

        var result = await _handler.Handle(new AssignLibraryTagCommand(
            _userId, _tagId, new[] { new LibraryItemRef("document", Guid.NewGuid()) }, Assign: true), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("TAG_NOT_FOUND", result.ErrorCode);
    }

    [Fact]
    public async Task Handle_RejectsUnknownItemKinds()
    {
        OwnsTag();

        var result = await _handler.Handle(new AssignLibraryTagCommand(
            _userId, _tagId, new[] { new LibraryItemRef("flashcard", Guid.NewGuid()) }, Assign: true), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("INVALID_ITEM_KIND", result.ErrorCode);
    }

    [Fact]
    public async Task Handle_RejectsAnEmptySelection()
    {
        OwnsTag();

        var result = await _handler.Handle(new AssignLibraryTagCommand(
            _userId, _tagId, Array.Empty<LibraryItemRef>(), Assign: true), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("NO_ITEMS", result.ErrorCode);
    }

    [Fact]
    public async Task Handle_RejectsAnOversizedBatch()
    {
        OwnsTag();
        var items = Enumerable.Range(0, 501)
            .Select(_ => new LibraryItemRef("document", Guid.NewGuid()))
            .ToArray();

        var result = await _handler.Handle(
            new AssignLibraryTagCommand(_userId, _tagId, items, Assign: true), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("TOO_MANY_ITEMS", result.ErrorCode);
    }

    /// <summary>Bulk assign over a mixed selection is normal; already-tagged items are not an error.</summary>
    [Fact]
    public async Task Handle_ReportsZeroWhenEverythingWasAlreadyTagged()
    {
        OwnsTag();
        var docId = Guid.NewGuid();
        DocumentsOwnedBy(_userId, docId);
        _tags.Setup(r => r.AssignAsync(_tagId, It.IsAny<IReadOnlyCollection<(string, Guid)>>(), default))
            .ReturnsAsync(0);

        var result = await _handler.Handle(new AssignLibraryTagCommand(
            _userId, _tagId, new[] { new LibraryItemRef("document", docId) }, Assign: true), default);

        Assert.True(result.IsSuccess);
        Assert.Equal(0, result.Data!.Changed);
        Assert.Contains("already", result.Message, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task Handle_UnassignRemovesWithoutTouchingTheItems()
    {
        OwnsTag();
        var docId = Guid.NewGuid();
        DocumentsOwnedBy(_userId, docId);
        _tags.Setup(r => r.UnassignAsync(_tagId, It.IsAny<IReadOnlyCollection<(string, Guid)>>(), default))
            .ReturnsAsync(1);

        var result = await _handler.Handle(new AssignLibraryTagCommand(
            _userId, _tagId, new[] { new LibraryItemRef("document", docId) }, Assign: false), default);

        Assert.True(result.IsSuccess);
        Assert.Equal(1, result.Data!.Changed);
        _documents.Verify(r => r.Remove(It.IsAny<Document>()), Times.Never);
    }
}
