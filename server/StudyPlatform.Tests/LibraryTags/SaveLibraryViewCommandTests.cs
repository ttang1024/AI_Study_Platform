using Moq;
using StudyPlatform.Application.LibraryTags.Commands;
using StudyPlatform.Domain.Entities;
using StudyPlatform.Domain.Interfaces;
using Xunit;

namespace StudyPlatform.Tests.LibraryTags;

public class SaveLibraryViewCommandHandlerTests
{
    private readonly Mock<IUnitOfWork> _uow = new();
    private readonly Mock<ISavedLibraryViewRepository> _views = new();
    private readonly SaveLibraryViewCommandHandler _handler;
    private readonly Guid _userId = Guid.NewGuid();

    public SaveLibraryViewCommandHandlerTests()
    {
        _uow.Setup(u => u.SavedLibraryViews).Returns(_views.Object);
        _uow.Setup(u => u.SaveChangesAsync(default)).ReturnsAsync(1);
        _views.Setup(r => r.GetForUserAsync(_userId, default)).ReturnsAsync(Array.Empty<SavedLibraryView>());
        _views.Setup(r => r.AddAsync(It.IsAny<SavedLibraryView>(), default)).Returns(Task.CompletedTask);
        _handler = new SaveLibraryViewCommandHandler(_uow.Object);
    }

    [Fact]
    public async Task Handle_BlankName_ReturnsFailure()
    {
        var result = await _handler.Handle(new SaveLibraryViewCommand(_userId, null, "  ", null, "{}", null), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("NAME_REQUIRED", result.ErrorCode);
    }

    [Fact]
    public async Task Handle_BlankFiltersJson_DefaultsToEmptyObject()
    {
        SavedLibraryView? captured = null;
        _views.Setup(r => r.AddAsync(It.IsAny<SavedLibraryView>(), default))
            .Callback<SavedLibraryView, CancellationToken>((v, _) => captured = v)
            .Returns(Task.CompletedTask);

        var result = await _handler.Handle(new SaveLibraryViewCommand(_userId, null, "My View", null, "", null), default);

        Assert.True(result.IsSuccess);
        Assert.Equal("{}", captured!.FiltersJson);
    }

    [Fact]
    public async Task Handle_FiltersNotAnObject_ReturnsFailure()
    {
        var result = await _handler.Handle(new SaveLibraryViewCommand(_userId, null, "My View", null, "[1,2,3]", null), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("INVALID_FILTERS", result.ErrorCode);
    }

    [Fact]
    public async Task Handle_MalformedFiltersJson_ReturnsFailure()
    {
        var result = await _handler.Handle(new SaveLibraryViewCommand(_userId, null, "My View", null, "{bad", null), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("INVALID_FILTERS", result.ErrorCode);
    }

    [Fact]
    public async Task Handle_NewView_AppendsAtPositionZeroWhenNoneExist()
    {
        SavedLibraryView? captured = null;
        _views.Setup(r => r.AddAsync(It.IsAny<SavedLibraryView>(), default))
            .Callback<SavedLibraryView, CancellationToken>((v, _) => captured = v)
            .Returns(Task.CompletedTask);

        await _handler.Handle(new SaveLibraryViewCommand(_userId, null, "My View", null, "{}", null), default);

        Assert.Equal(0, captured!.Position);
    }

    [Fact]
    public async Task Handle_NewView_AppendsAfterMaxExistingPosition()
    {
        _views.Setup(r => r.GetForUserAsync(_userId, default)).ReturnsAsync(new[]
        {
            new SavedLibraryView { SavedLibraryViewId = Guid.NewGuid(), UserId = _userId, Position = 3 },
            new SavedLibraryView { SavedLibraryViewId = Guid.NewGuid(), UserId = _userId, Position = 7 },
        });
        SavedLibraryView? captured = null;
        _views.Setup(r => r.AddAsync(It.IsAny<SavedLibraryView>(), default))
            .Callback<SavedLibraryView, CancellationToken>((v, _) => captured = v)
            .Returns(Task.CompletedTask);

        await _handler.Handle(new SaveLibraryViewCommand(_userId, null, "My View", null, "{}", null), default);

        Assert.Equal(8, captured!.Position);
    }

    [Fact]
    public async Task Handle_NewView_ExplicitPositionOverridesAppendLogic()
    {
        SavedLibraryView? captured = null;
        _views.Setup(r => r.AddAsync(It.IsAny<SavedLibraryView>(), default))
            .Callback<SavedLibraryView, CancellationToken>((v, _) => captured = v)
            .Returns(Task.CompletedTask);

        await _handler.Handle(new SaveLibraryViewCommand(_userId, null, "My View", null, "{}", 99), default);

        Assert.Equal(99, captured!.Position);
    }

    [Fact]
    public async Task Handle_AtViewLimit_ReturnsFailure()
    {
        var existing = Enumerable.Range(0, 50)
            .Select(i => new SavedLibraryView { SavedLibraryViewId = Guid.NewGuid(), UserId = _userId, Position = i })
            .ToArray();
        _views.Setup(r => r.GetForUserAsync(_userId, default)).ReturnsAsync(existing);

        var result = await _handler.Handle(new SaveLibraryViewCommand(_userId, null, "My View", null, "{}", null), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("TOO_MANY_VIEWS", result.ErrorCode);
    }

    [Fact]
    public async Task Handle_UpdateExistingView_NotOwned_ReturnsFailure()
    {
        var viewId = Guid.NewGuid();
        _views.Setup(r => r.GetByIdAsync(viewId, default)).ReturnsAsync(new SavedLibraryView { SavedLibraryViewId = viewId, UserId = Guid.NewGuid() });

        var result = await _handler.Handle(new SaveLibraryViewCommand(_userId, viewId, "My View", null, "{}", null), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("VIEW_NOT_FOUND", result.ErrorCode);
    }

    [Fact]
    public async Task Handle_UpdateExistingView_DoesNotChangePositionWhenNotSpecified()
    {
        var viewId = Guid.NewGuid();
        var existing = new SavedLibraryView { SavedLibraryViewId = viewId, UserId = _userId, Position = 3, Name = "Old" };
        _views.Setup(r => r.GetByIdAsync(viewId, default)).ReturnsAsync(existing);

        await _handler.Handle(new SaveLibraryViewCommand(_userId, viewId, "New Name", null, "{}", null), default);

        Assert.Equal(3, existing.Position);
        Assert.Equal("New Name", existing.Name);
        _views.Verify(r => r.Update(existing), Times.Once);
        _views.Verify(r => r.AddAsync(It.IsAny<SavedLibraryView>(), default), Times.Never);
    }

    [Fact]
    public async Task Handle_UpdateExistingView_ChangesPositionWhenSpecified()
    {
        var viewId = Guid.NewGuid();
        var existing = new SavedLibraryView { SavedLibraryViewId = viewId, UserId = _userId, Position = 3 };
        _views.Setup(r => r.GetByIdAsync(viewId, default)).ReturnsAsync(existing);

        await _handler.Handle(new SaveLibraryViewCommand(_userId, viewId, "New Name", null, "{}", 10), default);

        Assert.Equal(10, existing.Position);
    }
}

public class DeleteLibraryViewCommandHandlerTests
{
    private readonly Mock<IUnitOfWork> _uow = new();
    private readonly Mock<ISavedLibraryViewRepository> _views = new();
    private readonly DeleteLibraryViewCommandHandler _handler;
    private readonly Guid _userId = Guid.NewGuid();
    private readonly Guid _viewId = Guid.NewGuid();

    public DeleteLibraryViewCommandHandlerTests()
    {
        _uow.Setup(u => u.SavedLibraryViews).Returns(_views.Object);
        _uow.Setup(u => u.SaveChangesAsync(default)).ReturnsAsync(1);
        _handler = new DeleteLibraryViewCommandHandler(_uow.Object);
    }

    [Fact]
    public async Task Handle_NotOwned_ReturnsFailure()
    {
        _views.Setup(r => r.GetByIdAsync(_viewId, default)).ReturnsAsync(new SavedLibraryView { SavedLibraryViewId = _viewId, UserId = Guid.NewGuid() });

        var result = await _handler.Handle(new DeleteLibraryViewCommand(_userId, _viewId), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("VIEW_NOT_FOUND", result.ErrorCode);
    }

    [Fact]
    public async Task Handle_Owned_RemovesSuccessfully()
    {
        var view = new SavedLibraryView { SavedLibraryViewId = _viewId, UserId = _userId };
        _views.Setup(r => r.GetByIdAsync(_viewId, default)).ReturnsAsync(view);

        var result = await _handler.Handle(new DeleteLibraryViewCommand(_userId, _viewId), default);

        Assert.True(result.IsSuccess);
        _views.Verify(r => r.Remove(view), Times.Once);
    }
}

public class GetLibraryViewsQueryHandlerTests
{
    private readonly Mock<IUnitOfWork> _uow = new();
    private readonly Mock<ISavedLibraryViewRepository> _views = new();
    private readonly GetLibraryViewsQueryHandler _handler;
    private readonly Guid _userId = Guid.NewGuid();

    public GetLibraryViewsQueryHandlerTests()
    {
        _uow.Setup(u => u.SavedLibraryViews).Returns(_views.Object);
        _handler = new GetLibraryViewsQueryHandler(_uow.Object);
    }

    [Fact]
    public async Task Handle_MapsViewsToDtos()
    {
        _views.Setup(r => r.GetForUserAsync(_userId, default)).ReturnsAsync(new[]
        {
            new SavedLibraryView { SavedLibraryViewId = Guid.NewGuid(), UserId = _userId, Name = "My View", FiltersJson = "{}" },
        });

        var result = await _handler.Handle(new GetLibraryViewsQuery(_userId), default);

        Assert.True(result.IsSuccess);
        Assert.Equal("My View", result.Data!.Single().Name);
    }
}
