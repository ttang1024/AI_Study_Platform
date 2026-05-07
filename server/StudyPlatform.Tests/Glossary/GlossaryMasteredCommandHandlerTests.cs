using Moq;
using StudyPlatform.Application.Glossary.Commands;
using StudyPlatform.Domain.Entities;
using StudyPlatform.Domain.Interfaces;
using Xunit;

namespace StudyPlatform.Tests.Glossary;

public class ToggleGlossaryMasteredCommandHandlerTests
{
    private readonly Mock<IUnitOfWork> _uow = new();
    private readonly Mock<IGlossaryMasteredRepository> _masteredRepo = new();
    private readonly ToggleGlossaryMasteredCommandHandler _handler;
    private readonly Guid _userId = Guid.NewGuid();
    private readonly Guid _termId = Guid.NewGuid();

    public ToggleGlossaryMasteredCommandHandlerTests()
    {
        _uow.Setup(u => u.GlossaryMastered).Returns(_masteredRepo.Object);
        _uow.Setup(u => u.SaveChangesAsync(default)).ReturnsAsync(1);
        _handler = new ToggleGlossaryMasteredCommandHandler(_uow.Object);
    }

    [Fact]
    public async Task Handle_NotMastered_AddsMasteredAndReturnsTrue()
    {
        _masteredRepo.Setup(r => r.GetByUserAndTermAsync(_userId, _termId, default)).ReturnsAsync((GlossaryMastered?)null);
        _masteredRepo.Setup(r => r.AddAsync(It.IsAny<GlossaryMastered>(), default)).Returns(Task.CompletedTask);

        var result = await _handler.Handle(new ToggleGlossaryMasteredCommand(_userId, _termId), default);

        Assert.True(result.IsSuccess);
        Assert.True(result.Data);
        _masteredRepo.Verify(r => r.AddAsync(It.Is<GlossaryMastered>(m => m.UserId == _userId && m.GlossaryTermId == _termId), default), Times.Once);
        _uow.Verify(u => u.SaveChangesAsync(default), Times.Once);
    }

    [Fact]
    public async Task Handle_AlreadyMastered_RemovesAndReturnsFalse()
    {
        var existing = new GlossaryMastered { Id = Guid.NewGuid(), UserId = _userId, GlossaryTermId = _termId };
        _masteredRepo.Setup(r => r.GetByUserAndTermAsync(_userId, _termId, default)).ReturnsAsync(existing);

        var result = await _handler.Handle(new ToggleGlossaryMasteredCommand(_userId, _termId), default);

        Assert.True(result.IsSuccess);
        Assert.False(result.Data);
        _masteredRepo.Verify(r => r.Remove(existing), Times.Once);
        _masteredRepo.Verify(r => r.AddAsync(It.IsAny<GlossaryMastered>(), default), Times.Never);
        _uow.Verify(u => u.SaveChangesAsync(default), Times.Once);
    }
}

public class GetMasteredGlossaryIdsQueryHandlerTests
{
    private readonly Mock<IUnitOfWork> _uow = new();
    private readonly Mock<IGlossaryMasteredRepository> _masteredRepo = new();
    private readonly GetMasteredGlossaryIdsQueryHandler _handler;
    private readonly Guid _userId = Guid.NewGuid();

    public GetMasteredGlossaryIdsQueryHandlerTests()
    {
        _uow.Setup(u => u.GlossaryMastered).Returns(_masteredRepo.Object);
        _handler = new GetMasteredGlossaryIdsQueryHandler(_uow.Object);
    }

    [Fact]
    public async Task Handle_ReturnsMasteredTermIds()
    {
        var termIds = new[] { Guid.NewGuid(), Guid.NewGuid() };
        _masteredRepo.Setup(r => r.GetMasteredTermIdsByUserAsync(_userId, default)).ReturnsAsync(termIds.AsEnumerable());

        var result = await _handler.Handle(new GetMasteredGlossaryIdsQuery(_userId), default);

        Assert.True(result.IsSuccess);
        Assert.Equal(2, result.Data!.Count());
    }

    [Fact]
    public async Task Handle_NoMasteredTerms_ReturnsEmptyCollection()
    {
        _masteredRepo.Setup(r => r.GetMasteredTermIdsByUserAsync(_userId, default)).ReturnsAsync(Enumerable.Empty<Guid>());

        var result = await _handler.Handle(new GetMasteredGlossaryIdsQuery(_userId), default);

        Assert.True(result.IsSuccess);
        Assert.Empty(result.Data!);
    }
}
