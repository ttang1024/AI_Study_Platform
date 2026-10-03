using Moq;
using StudyPlatform.Application.WorkedProblems.Commands;
using StudyPlatform.Domain.Entities;
using StudyPlatform.Domain.Interfaces;
using Xunit;

namespace StudyPlatform.Tests.WorkedProblems;

public class ToggleWorkedProblemMasteredCommandHandlerTests
{
    private readonly Mock<IUnitOfWork> _uow = new();
    private readonly Mock<IWorkedProblemMasteredRepository> _masteredRepo = new();
    private readonly ToggleWorkedProblemMasteredCommandHandler _handler;
    private readonly Guid _userId = Guid.NewGuid();
    private readonly Guid _problemId = Guid.NewGuid();

    public ToggleWorkedProblemMasteredCommandHandlerTests()
    {
        _uow.Setup(u => u.WorkedProblemMastered).Returns(_masteredRepo.Object);
        _uow.Setup(u => u.SaveChangesAsync(default)).ReturnsAsync(1);
        _masteredRepo.Setup(r => r.AddAsync(It.IsAny<WorkedProblemMastered>(), default)).Returns(Task.CompletedTask);
        _handler = new ToggleWorkedProblemMasteredCommandHandler(_uow.Object);
    }

    [Fact]
    public async Task Handle_NotYetMastered_CreatesEntryAndReturnsTrue()
    {
        _masteredRepo.Setup(r => r.GetByUserAndProblemAsync(_userId, _problemId, default))
            .ReturnsAsync((WorkedProblemMastered?)null);

        var result = await _handler.Handle(new ToggleWorkedProblemMasteredCommand(_userId, _problemId), default);

        Assert.True(result.IsSuccess);
        Assert.True(result.Data);
        _masteredRepo.Verify(r => r.AddAsync(
            It.Is<WorkedProblemMastered>(m => m.UserId == _userId && m.WorkedProblemId == _problemId),
            default), Times.Once);
        _uow.Verify(u => u.SaveChangesAsync(default), Times.Once);
    }

    [Fact]
    public async Task Handle_AlreadyMastered_RemovesEntryAndReturnsFalse()
    {
        var existing = new WorkedProblemMastered
        {
            Id = Guid.NewGuid(),
            UserId = _userId,
            WorkedProblemId = _problemId,
            MasteredAt = DateTime.UtcNow.AddDays(-1),
        };
        _masteredRepo.Setup(r => r.GetByUserAndProblemAsync(_userId, _problemId, default))
            .ReturnsAsync(existing);

        var result = await _handler.Handle(new ToggleWorkedProblemMasteredCommand(_userId, _problemId), default);

        Assert.True(result.IsSuccess);
        Assert.False(result.Data);
        _masteredRepo.Verify(r => r.Remove(existing), Times.Once);
        _masteredRepo.Verify(r => r.AddAsync(It.IsAny<WorkedProblemMastered>(), default), Times.Never);
        _uow.Verify(u => u.SaveChangesAsync(default), Times.Once);
    }
}

public class GetMasteredProblemIdsQueryHandlerTests
{
    private readonly Mock<IUnitOfWork> _uow = new();
    private readonly Mock<IWorkedProblemMasteredRepository> _masteredRepo = new();
    private readonly GetMasteredProblemIdsQueryHandler _handler;
    private readonly Guid _userId = Guid.NewGuid();

    public GetMasteredProblemIdsQueryHandlerTests()
    {
        _uow.Setup(u => u.WorkedProblemMastered).Returns(_masteredRepo.Object);
        _handler = new GetMasteredProblemIdsQueryHandler(_uow.Object);
    }

    [Fact]
    public async Task Handle_ReturnsMasteredIds()
    {
        var id1 = Guid.NewGuid();
        var id2 = Guid.NewGuid();
        _masteredRepo.Setup(r => r.GetMasteredProblemIdsByUserAsync(_userId, default))
            .ReturnsAsync(new[] { id1, id2 });

        var result = await _handler.Handle(new GetMasteredProblemIdsQuery(_userId), default);

        Assert.True(result.IsSuccess);
        Assert.Contains(id1, result.Data!);
        Assert.Contains(id2, result.Data!);
    }

    [Fact]
    public async Task Handle_NoMasteredProblems_ReturnsEmptyList()
    {
        _masteredRepo.Setup(r => r.GetMasteredProblemIdsByUserAsync(_userId, default))
            .ReturnsAsync(Array.Empty<Guid>());

        var result = await _handler.Handle(new GetMasteredProblemIdsQuery(_userId), default);

        Assert.True(result.IsSuccess);
        Assert.Empty(result.Data!);
    }
}
