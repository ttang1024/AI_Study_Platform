using Moq;
using StudyPlatform.Application.Auth.Commands;
using StudyPlatform.Application.Services;
using StudyPlatform.Domain.Entities;
using StudyPlatform.Domain.Interfaces;
using Xunit;

namespace StudyPlatform.Tests.Auth;

public class ChangePasswordCommandHandlerTests
{
    private readonly Mock<IUnitOfWork> _uow = new();
    private readonly Mock<IUserRepository> _users = new();
    private readonly Mock<IPasswordHasher> _hasher = new();
    private readonly ChangePasswordCommandHandler _handler;
    private readonly Guid _userId = Guid.NewGuid();

    public ChangePasswordCommandHandlerTests()
    {
        _uow.Setup(u => u.Users).Returns(_users.Object);
        _uow.Setup(u => u.SaveChangesAsync(default)).ReturnsAsync(1);
        _handler = new ChangePasswordCommandHandler(_uow.Object, _hasher.Object);
    }

    private User MakeUser() => new()
    {
        UserId = _userId,
        Email = "user@example.com",
        PasswordHash = "old-hash"
    };

    [Fact]
    public async Task Handle_CorrectCurrentPassword_ChangesAndReturnsSuccess()
    {
        var user = MakeUser();
        _users.Setup(r => r.GetByIdAsync(_userId, default)).ReturnsAsync(user);
        _hasher.Setup(h => h.Verify("OldPass1", "old-hash")).Returns(true);
        _hasher.Setup(h => h.Hash("NewPass1")).Returns("new-hash");

        var result = await _handler.Handle(new ChangePasswordCommand(_userId, "OldPass1", "NewPass1"), default);

        Assert.True(result.IsSuccess);
        Assert.Equal("new-hash", user.PasswordHash);
        _users.Verify(r => r.Update(user), Times.Once);
        _uow.Verify(u => u.SaveChangesAsync(default), Times.Once);
    }

    [Fact]
    public async Task Handle_UserNotFound_ReturnsFailure()
    {
        _users.Setup(r => r.GetByIdAsync(_userId, default)).ReturnsAsync((User?)null);

        var result = await _handler.Handle(new ChangePasswordCommand(_userId, "OldPass1", "NewPass1"), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("USER_NOT_FOUND", result.ErrorCode);
        _uow.Verify(u => u.SaveChangesAsync(default), Times.Never);
    }

    [Fact]
    public async Task Handle_WrongCurrentPassword_ReturnsFailure()
    {
        var user = MakeUser();
        _users.Setup(r => r.GetByIdAsync(_userId, default)).ReturnsAsync(user);
        _hasher.Setup(h => h.Verify("WrongPass", "old-hash")).Returns(false);

        var result = await _handler.Handle(new ChangePasswordCommand(_userId, "WrongPass", "NewPass1"), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("INVALID_PASSWORD", result.ErrorCode);
        _uow.Verify(u => u.SaveChangesAsync(default), Times.Never);
    }
}
