using Moq;
using StudyPlatform.Application.LibraryTags.Commands;
using StudyPlatform.Application.LibraryTags.Queries;
using StudyPlatform.Domain.Entities;
using StudyPlatform.Domain.Interfaces;
using Xunit;

namespace StudyPlatform.Tests.LibraryTags;

public class GetLibraryTagsQueryHandlerTests
{
    private readonly Mock<IUnitOfWork> _uow = new();
    private readonly Mock<ILibraryTagRepository> _tags = new();
    private readonly GetLibraryTagsQueryHandler _handler;
    private readonly Guid _userId = Guid.NewGuid();

    public GetLibraryTagsQueryHandlerTests()
    {
        _uow.Setup(u => u.LibraryTags).Returns(_tags.Object);
        _handler = new GetLibraryTagsQueryHandler(_uow.Object);
    }

    [Fact]
    public async Task Handle_NullKind_PassesNullThrough()
    {
        _tags.Setup(r => r.GetForUserAsync(_userId, null, default)).ReturnsAsync(Array.Empty<LibraryTagWithCount>());

        await _handler.Handle(new GetLibraryTagsQuery(_userId, null), default);

        _tags.Verify(r => r.GetForUserAsync(_userId, null, default), Times.Once);
    }

    [Fact]
    public async Task Handle_KindNormalizedToLowercaseAndTrimmed()
    {
        _tags.Setup(r => r.GetForUserAsync(_userId, "collection", default)).ReturnsAsync(Array.Empty<LibraryTagWithCount>());

        await _handler.Handle(new GetLibraryTagsQuery(_userId, "  COLLECTION  "), default);

        _tags.Verify(r => r.GetForUserAsync(_userId, "collection", default), Times.Once);
    }

    [Fact]
    public async Task Handle_MapsTagAndItemCount()
    {
        var tag = new LibraryTag { LibraryTagId = Guid.NewGuid(), Name = "Important", Kind = "tag", CreatedAt = DateTime.UtcNow };
        _tags.Setup(r => r.GetForUserAsync(_userId, null, default)).ReturnsAsync(new[] { new LibraryTagWithCount(tag, 5) });

        var result = await _handler.Handle(new GetLibraryTagsQuery(_userId, null), default);

        var dto = Assert.Single(result.Data!);
        Assert.Equal(5, dto.ItemCount);
        Assert.Equal("Important", dto.Name);
    }
}

public class CreateLibraryTagCommandHandlerTests
{
    private readonly Mock<IUnitOfWork> _uow = new();
    private readonly Mock<ILibraryTagRepository> _tags = new();
    private readonly CreateLibraryTagCommandHandler _handler;
    private readonly Guid _userId = Guid.NewGuid();

    public CreateLibraryTagCommandHandlerTests()
    {
        _uow.Setup(u => u.LibraryTags).Returns(_tags.Object);
        _uow.Setup(u => u.SaveChangesAsync(default)).ReturnsAsync(1);
        _tags.Setup(r => r.GetByNameAsync(_userId, It.IsAny<string>(), It.IsAny<string>(), default)).ReturnsAsync((LibraryTag?)null);
        _tags.Setup(r => r.AddAsync(It.IsAny<LibraryTag>(), default)).Returns(Task.CompletedTask);
        _handler = new CreateLibraryTagCommandHandler(_uow.Object);
    }

    [Fact]
    public async Task Handle_BlankName_ReturnsFailure()
    {
        var result = await _handler.Handle(new CreateLibraryTagCommand(_userId, "  ", "tag", null, null), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("NAME_REQUIRED", result.ErrorCode);
    }

    [Fact]
    public async Task Handle_InvalidKind_ReturnsFailure()
    {
        var result = await _handler.Handle(new CreateLibraryTagCommand(_userId, "Important", "folder", null, null), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("INVALID_KIND", result.ErrorCode);
    }

    [Fact]
    public async Task Handle_DuplicateName_ReturnsFailure()
    {
        _tags.Setup(r => r.GetByNameAsync(_userId, "Important", "tag", default))
            .ReturnsAsync(new LibraryTag { LibraryTagId = Guid.NewGuid(), Name = "Important", Kind = "tag" });

        var result = await _handler.Handle(new CreateLibraryTagCommand(_userId, "Important", "tag", null, null), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("DUPLICATE_NAME", result.ErrorCode);
    }

    [Fact]
    public async Task Handle_TagKind_DropsDescription()
    {
        LibraryTag? captured = null;
        _tags.Setup(r => r.AddAsync(It.IsAny<LibraryTag>(), default))
            .Callback<LibraryTag, CancellationToken>((t, _) => captured = t)
            .Returns(Task.CompletedTask);

        await _handler.Handle(new CreateLibraryTagCommand(_userId, "Important", "tag", "#f00", "should be dropped"), default);

        Assert.Null(captured!.Description);
    }

    [Fact]
    public async Task Handle_CollectionKind_KeepsDescription()
    {
        LibraryTag? captured = null;
        _tags.Setup(r => r.AddAsync(It.IsAny<LibraryTag>(), default))
            .Callback<LibraryTag, CancellationToken>((t, _) => captured = t)
            .Returns(Task.CompletedTask);

        var result = await _handler.Handle(new CreateLibraryTagCommand(_userId, "CS 101", "collection", null, "My collection"), default);

        Assert.Equal("My collection", captured!.Description);
        Assert.Equal("Collection created.", result.Message);
    }

    [Fact]
    public async Task Handle_DefaultsKindToTagWhenNull()
    {
        LibraryTag? captured = null;
        _tags.Setup(r => r.AddAsync(It.IsAny<LibraryTag>(), default))
            .Callback<LibraryTag, CancellationToken>((t, _) => captured = t)
            .Returns(Task.CompletedTask);

        await _handler.Handle(new CreateLibraryTagCommand(_userId, "Important", null!, null, null), default);

        Assert.Equal("tag", captured!.Kind);
    }

    [Fact]
    public async Task Handle_BlankKind_IsInvalidRatherThanDefaulted()
    {
        // Only a null Kind defaults via `??`; an empty string still normalizes to "" and fails validation.
        var result = await _handler.Handle(new CreateLibraryTagCommand(_userId, "Important", "", null, null), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("INVALID_KIND", result.ErrorCode);
    }
}

public class UpdateLibraryTagCommandHandlerTests
{
    private readonly Mock<IUnitOfWork> _uow = new();
    private readonly Mock<ILibraryTagRepository> _tags = new();
    private readonly UpdateLibraryTagCommandHandler _handler;
    private readonly Guid _userId = Guid.NewGuid();
    private readonly Guid _tagId = Guid.NewGuid();

    public UpdateLibraryTagCommandHandlerTests()
    {
        _uow.Setup(u => u.LibraryTags).Returns(_tags.Object);
        _uow.Setup(u => u.SaveChangesAsync(default)).ReturnsAsync(1);
        _tags.Setup(r => r.GetForUserAsync(_userId, It.IsAny<string?>(), default)).ReturnsAsync(Array.Empty<LibraryTagWithCount>());
        _handler = new UpdateLibraryTagCommandHandler(_uow.Object);
    }

    [Fact]
    public async Task Handle_NotOwned_ReturnsFailure()
    {
        _tags.Setup(r => r.GetByIdAsync(_tagId, default)).ReturnsAsync(new LibraryTag { LibraryTagId = _tagId, UserId = Guid.NewGuid() });

        var result = await _handler.Handle(new UpdateLibraryTagCommand(_userId, _tagId, "New", null, null), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("TAG_NOT_FOUND", result.ErrorCode);
    }

    [Fact]
    public async Task Handle_BlankName_ReturnsFailure()
    {
        _tags.Setup(r => r.GetByIdAsync(_tagId, default)).ReturnsAsync(new LibraryTag { LibraryTagId = _tagId, UserId = _userId, Name = "Old" });

        var result = await _handler.Handle(new UpdateLibraryTagCommand(_userId, _tagId, "   ", null, null), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("NAME_REQUIRED", result.ErrorCode);
    }

    [Fact]
    public async Task Handle_RenamingToSameName_SkipsDuplicateCheck()
    {
        var tag = new LibraryTag { LibraryTagId = _tagId, UserId = _userId, Name = "Important", Kind = "tag" };
        _tags.Setup(r => r.GetByIdAsync(_tagId, default)).ReturnsAsync(tag);

        var result = await _handler.Handle(new UpdateLibraryTagCommand(_userId, _tagId, "IMPORTANT", null, null), default);

        Assert.True(result.IsSuccess);
        _tags.Verify(r => r.GetByNameAsync(It.IsAny<Guid>(), It.IsAny<string>(), It.IsAny<string>(), default), Times.Never);
    }

    [Fact]
    public async Task Handle_RenameCollidesWithAnotherTag_ReturnsFailure()
    {
        var tag = new LibraryTag { LibraryTagId = _tagId, UserId = _userId, Name = "Old", Kind = "tag" };
        _tags.Setup(r => r.GetByIdAsync(_tagId, default)).ReturnsAsync(tag);
        _tags.Setup(r => r.GetByNameAsync(_userId, "New", "tag", default))
            .ReturnsAsync(new LibraryTag { LibraryTagId = Guid.NewGuid(), Name = "New", Kind = "tag" });

        var result = await _handler.Handle(new UpdateLibraryTagCommand(_userId, _tagId, "New", null, null), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("DUPLICATE_NAME", result.ErrorCode);
    }

    [Fact]
    public async Task Handle_TagKind_IgnoresDescriptionUpdate()
    {
        var tag = new LibraryTag { LibraryTagId = _tagId, UserId = _userId, Name = "Old", Kind = "tag", Description = null };
        _tags.Setup(r => r.GetByIdAsync(_tagId, default)).ReturnsAsync(tag);
        _tags.Setup(r => r.GetByNameAsync(_userId, "New", "tag", default)).ReturnsAsync((LibraryTag?)null);

        await _handler.Handle(new UpdateLibraryTagCommand(_userId, _tagId, "New", null, "should be ignored"), default);

        Assert.Null(tag.Description);
    }

    [Fact]
    public async Task Handle_CollectionKind_UpdatesDescription()
    {
        var tag = new LibraryTag { LibraryTagId = _tagId, UserId = _userId, Name = "CS 101", Kind = "collection" };
        _tags.Setup(r => r.GetByIdAsync(_tagId, default)).ReturnsAsync(tag);

        await _handler.Handle(new UpdateLibraryTagCommand(_userId, _tagId, "CS 101", null, "new description"), default);

        Assert.Equal("new description", tag.Description);
    }

    [Fact]
    public async Task Handle_ReturnsItemCountFromRefreshedList()
    {
        var tag = new LibraryTag { LibraryTagId = _tagId, UserId = _userId, Name = "CS 101", Kind = "collection" };
        _tags.Setup(r => r.GetByIdAsync(_tagId, default)).ReturnsAsync(tag);
        _tags.Setup(r => r.GetForUserAsync(_userId, "collection", default))
            .ReturnsAsync(new[] { new LibraryTagWithCount(tag, 7) });

        var result = await _handler.Handle(new UpdateLibraryTagCommand(_userId, _tagId, "CS 101", null, null), default);

        Assert.Equal(7, result.Data!.ItemCount);
    }
}

public class DeleteLibraryTagCommandHandlerTests
{
    private readonly Mock<IUnitOfWork> _uow = new();
    private readonly Mock<ILibraryTagRepository> _tags = new();
    private readonly DeleteLibraryTagCommandHandler _handler;
    private readonly Guid _userId = Guid.NewGuid();
    private readonly Guid _tagId = Guid.NewGuid();

    public DeleteLibraryTagCommandHandlerTests()
    {
        _uow.Setup(u => u.LibraryTags).Returns(_tags.Object);
        _uow.Setup(u => u.SaveChangesAsync(default)).ReturnsAsync(1);
        _handler = new DeleteLibraryTagCommandHandler(_uow.Object);
    }

    [Fact]
    public async Task Handle_NotOwned_ReturnsFailure()
    {
        _tags.Setup(r => r.GetByIdAsync(_tagId, default)).ReturnsAsync(new LibraryTag { LibraryTagId = _tagId, UserId = Guid.NewGuid() });

        var result = await _handler.Handle(new DeleteLibraryTagCommand(_userId, _tagId), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("TAG_NOT_FOUND", result.ErrorCode);
    }

    [Fact]
    public async Task Handle_Owned_RemovesSuccessfully()
    {
        var tag = new LibraryTag { LibraryTagId = _tagId, UserId = _userId };
        _tags.Setup(r => r.GetByIdAsync(_tagId, default)).ReturnsAsync(tag);

        var result = await _handler.Handle(new DeleteLibraryTagCommand(_userId, _tagId), default);

        Assert.True(result.IsSuccess);
        _tags.Verify(r => r.Remove(tag), Times.Once);
    }
}
