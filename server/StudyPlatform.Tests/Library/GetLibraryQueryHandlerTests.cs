using Moq;
using StudyPlatform.Application.Library.Queries;
using StudyPlatform.Domain.Entities;
using StudyPlatform.Domain.Interfaces;
using StudyPlatform.Domain.Projections;
using Xunit;

namespace StudyPlatform.Tests.Library;

public class GetLibraryQueryHandlerTests
{
    private readonly Mock<ILibraryRepository> _library = new();
    private readonly Mock<IUnitOfWork> _uow = new();
    private readonly Mock<ILibraryTagRepository> _tags = new();
    private readonly GetLibraryQueryHandler _handler;
    private readonly Guid _userId = Guid.NewGuid();

    public GetLibraryQueryHandlerTests()
    {
        _uow.Setup(u => u.LibraryTags).Returns(_tags.Object);
        _tags.Setup(r => r.GetAssignmentsAsync(_userId, It.IsAny<IReadOnlyList<(string, Guid)>>(), default))
            .ReturnsAsync(new Dictionary<(string, Guid), List<LibraryTag>>());
        _handler = new GetLibraryQueryHandler(_library.Object, _uow.Object);
    }

    private LibraryItem MakeItem(string kind = "document") => new()
    {
        Kind = kind,
        Id = Guid.NewGuid(),
        CourseId = Guid.NewGuid(),
        CourseName = "Algorithms",
        CourseColor = "#000",
        CreatedAt = DateTime.UtcNow,
    };

    [Fact]
    public async Task Handle_InvalidType_FallsBackToAll()
    {
        _library.Setup(r => r.GetPagedAsync(_userId, "all", null, null, 1, 8, null, default))
            .ReturnsAsync((new List<LibraryItem>(), 0));

        var result = await _handler.Handle(new GetLibraryQuery(_userId, "bogus-type", null, null, 1, 8), default);

        Assert.True(result.IsSuccess);
        _library.Verify(r => r.GetPagedAsync(_userId, "all", null, null, 1, 8, null, default), Times.Once);
    }

    [Fact]
    public async Task Handle_LowercasesAValidType()
    {
        _library.Setup(r => r.GetPagedAsync(_userId, "videos", null, null, 1, 8, null, default))
            .ReturnsAsync((new List<LibraryItem>(), 0));

        await _handler.Handle(new GetLibraryQuery(_userId, "VIDEOS", null, null, 1, 8), default);

        _library.Verify(r => r.GetPagedAsync(_userId, "videos", null, null, 1, 8, null, default), Times.Once);
    }

    [Fact]
    public async Task Handle_ClampsPageBelow1To1()
    {
        _library.Setup(r => r.GetPagedAsync(_userId, "all", null, null, 1, 8, null, default))
            .ReturnsAsync((new List<LibraryItem>(), 0));

        await _handler.Handle(new GetLibraryQuery(_userId, "all", null, null, 0, 8), default);

        _library.Verify(r => r.GetPagedAsync(_userId, "all", null, null, 1, 8, null, default), Times.Once);
    }

    [Theory]
    [InlineData(0)]
    [InlineData(101)]
    [InlineData(-5)]
    public async Task Handle_InvalidPageSize_FallsBackTo8(int pageSize)
    {
        _library.Setup(r => r.GetPagedAsync(_userId, "all", null, null, 1, 8, null, default))
            .ReturnsAsync((new List<LibraryItem>(), 0));

        await _handler.Handle(new GetLibraryQuery(_userId, "all", null, null, 1, pageSize), default);

        _library.Verify(r => r.GetPagedAsync(_userId, "all", null, null, 1, 8, null, default), Times.Once);
    }

    [Fact]
    public async Task Handle_MapsItemsAndAttachesTags()
    {
        var item = MakeItem();
        _library.Setup(r => r.GetPagedAsync(_userId, "all", null, null, 1, 8, null, default))
            .ReturnsAsync((new List<LibraryItem> { item }, 1));
        var tag = new LibraryTag { LibraryTagId = Guid.NewGuid(), Name = "Important", Kind = "tag", Color = "#f00" };
        _tags.Setup(r => r.GetAssignmentsAsync(_userId, It.IsAny<IReadOnlyList<(string, Guid)>>(), default))
            .ReturnsAsync(new Dictionary<(string, Guid), List<LibraryTag>> { [(item.Kind, item.Id)] = new() { tag } });

        var result = await _handler.Handle(new GetLibraryQuery(_userId, "all", null, null, 1, 8), default);

        var dto = result.Data!.Items.Single();
        Assert.Single(dto.Tags);
        Assert.Equal("Important", dto.Tags[0].Name);
    }

    [Fact]
    public async Task Handle_ItemWithNoTagAssignments_GetsEmptyTagsList()
    {
        var item = MakeItem();
        _library.Setup(r => r.GetPagedAsync(_userId, "all", null, null, 1, 8, null, default))
            .ReturnsAsync((new List<LibraryItem> { item }, 1));

        var result = await _handler.Handle(new GetLibraryQuery(_userId, "all", null, null, 1, 8), default);

        Assert.Empty(result.Data!.Items.Single().Tags);
    }

    [Fact]
    public async Task Handle_PassesTagIdsThrough()
    {
        var tagIds = new List<Guid> { Guid.NewGuid() };
        _library.Setup(r => r.GetPagedAsync(_userId, "all", null, null, 1, 8, tagIds, default))
            .ReturnsAsync((new List<LibraryItem>(), 0));

        var result = await _handler.Handle(new GetLibraryQuery(_userId, "all", null, null, 1, 8, tagIds), default);

        Assert.True(result.IsSuccess);
        _library.Verify(r => r.GetPagedAsync(_userId, "all", null, null, 1, 8, tagIds, default), Times.Once);
    }

    [Fact]
    public async Task Handle_ReturnsTotalCountFromRepository()
    {
        _library.Setup(r => r.GetPagedAsync(_userId, "all", null, null, 1, 8, null, default))
            .ReturnsAsync((new List<LibraryItem> { MakeItem() }, 42));

        var result = await _handler.Handle(new GetLibraryQuery(_userId, "all", null, null, 1, 8), default);

        Assert.Equal(42, result.Data!.TotalCount);
    }
}
