using Moq;
using StudyPlatform.Application.Security.Commands;
using StudyPlatform.Application.Services;
using StudyPlatform.Domain.Entities;
using StudyPlatform.Domain.Interfaces;
using Xunit;

namespace StudyPlatform.Tests.Security;

public class RequestAccountDeletionCommandHandlerTests
{
    private readonly Mock<IUnitOfWork> _uow = new();
    private readonly Mock<IUserRepository> _users = new();
    private readonly Mock<IRefreshTokenRepository> _tokens = new();
    private readonly Mock<IPasswordHasher> _hasher = new();
    private readonly Mock<IAuditLogger> _audit = new();
    private readonly RequestAccountDeletionCommandHandler _handler;
    private readonly Guid _userId = Guid.NewGuid();

    public RequestAccountDeletionCommandHandlerTests()
    {
        _uow.Setup(u => u.Users).Returns(_users.Object);
        _uow.Setup(u => u.RefreshTokens).Returns(_tokens.Object);
        _uow.Setup(u => u.SaveChangesAsync(default)).ReturnsAsync(1);
        _users.Setup(r => r.GetByIdAsync(_userId, default)).ReturnsAsync(new User { UserId = _userId, PasswordHash = "hash" });
        _tokens.Setup(r => r.RevokeAllUserTokensAsync(_userId, default)).Returns(Task.CompletedTask);
        _handler = new RequestAccountDeletionCommandHandler(_uow.Object, _hasher.Object, _audit.Object);
    }

    private const string Confirmation = RequestAccountDeletionCommandHandler.RequiredConfirmation;

    [Fact]
    public async Task Handle_UserNotFound_ReturnsFailure()
    {
        _users.Setup(r => r.GetByIdAsync(_userId, default)).ReturnsAsync((User?)null);

        var result = await _handler.Handle(new RequestAccountDeletionCommand(_userId, "pw", Confirmation), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("USER_NOT_FOUND", result.ErrorCode);
    }

    [Fact]
    public async Task Handle_WrongConfirmationPhrase_ReturnsFailure()
    {
        var result = await _handler.Handle(new RequestAccountDeletionCommand(_userId, "pw", "delete my account"), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("CONFIRMATION_MISMATCH", result.ErrorCode);
    }

    [Fact]
    public async Task Handle_ConfirmationChecked_BeforePassword()
    {
        var result = await _handler.Handle(new RequestAccountDeletionCommand(_userId, "wrong-pw", "nope"), default);

        Assert.Equal("CONFIRMATION_MISMATCH", result.ErrorCode);
        _hasher.Verify(h => h.Verify(It.IsAny<string>(), It.IsAny<string>()), Times.Never);
    }

    [Fact]
    public async Task Handle_WrongPassword_ReturnsFailure()
    {
        _hasher.Setup(h => h.Verify("wrong", "hash")).Returns(false);

        var result = await _handler.Handle(new RequestAccountDeletionCommand(_userId, "wrong", Confirmation), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("INVALID_PASSWORD", result.ErrorCode);
    }

    [Fact]
    public async Task Handle_AlreadyRequested_ReturnsFailure()
    {
        _hasher.Setup(h => h.Verify("pw", "hash")).Returns(true);
        _users.Setup(r => r.GetByIdAsync(_userId, default))
            .ReturnsAsync(new User { UserId = _userId, PasswordHash = "hash", DeletionRequestedAt = DateTime.UtcNow });

        var result = await _handler.Handle(new RequestAccountDeletionCommand(_userId, "pw", Confirmation), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("DELETION_ALREADY_REQUESTED", result.ErrorCode);
    }

    [Fact]
    public async Task Handle_ValidRequest_DeactivatesAndRevokesAllSessions()
    {
        _hasher.Setup(h => h.Verify("pw", "hash")).Returns(true);
        var user = new User { UserId = _userId, PasswordHash = "hash", IsActive = true };
        _users.Setup(r => r.GetByIdAsync(_userId, default)).ReturnsAsync(user);

        var result = await _handler.Handle(new RequestAccountDeletionCommand(_userId, "pw", Confirmation), default);

        Assert.True(result.IsSuccess);
        Assert.False(user.IsActive);
        Assert.NotNull(user.DeletionRequestedAt);
        _tokens.Verify(t => t.RevokeAllUserTokensAsync(_userId, default), Times.Once);
    }

    [Fact]
    public async Task Handle_ScheduledDateIs7DaysOut()
    {
        _hasher.Setup(h => h.Verify("pw", "hash")).Returns(true);

        var before = DateTime.UtcNow;
        var result = await _handler.Handle(new RequestAccountDeletionCommand(_userId, "pw", Confirmation), default);
        var after = DateTime.UtcNow;

        Assert.InRange(result.Data, before.Add(RequestAccountDeletionCommandHandler.GracePeriod), after.Add(RequestAccountDeletionCommandHandler.GracePeriod));
    }
}

public class CancelAccountDeletionCommandHandlerTests
{
    private readonly Mock<IUnitOfWork> _uow = new();
    private readonly Mock<IUserRepository> _users = new();
    private readonly Mock<IPasswordHasher> _hasher = new();
    private readonly Mock<IAuditLogger> _audit = new();
    private readonly CancelAccountDeletionCommandHandler _handler;

    public CancelAccountDeletionCommandHandlerTests()
    {
        _uow.Setup(u => u.Users).Returns(_users.Object);
        _uow.Setup(u => u.SaveChangesAsync(default)).ReturnsAsync(1);
        _handler = new CancelAccountDeletionCommandHandler(_uow.Object, _hasher.Object, _audit.Object);
    }

    [Fact]
    public async Task Handle_UnknownEmail_ReturnsGenericInvalidCredentials()
    {
        _users.Setup(r => r.GetByEmailAsync("a@b.com", default)).ReturnsAsync((User?)null);

        var result = await _handler.Handle(new CancelAccountDeletionCommand("a@b.com", "pw"), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("INVALID_CREDENTIALS", result.ErrorCode);
    }

    [Fact]
    public async Task Handle_WrongPassword_ReturnsSameGenericError()
    {
        _users.Setup(r => r.GetByEmailAsync("a@b.com", default)).ReturnsAsync(new User { Email = "a@b.com", PasswordHash = "hash" });
        _hasher.Setup(h => h.Verify("wrong", "hash")).Returns(false);

        var result = await _handler.Handle(new CancelAccountDeletionCommand("a@b.com", "wrong"), default);

        Assert.Equal("INVALID_CREDENTIALS", result.ErrorCode);
    }

    [Fact]
    public async Task Handle_NoPendingDeletion_ReturnsFailure()
    {
        _users.Setup(r => r.GetByEmailAsync("a@b.com", default))
            .ReturnsAsync(new User { Email = "a@b.com", PasswordHash = "hash", DeletionRequestedAt = null });
        _hasher.Setup(h => h.Verify("pw", "hash")).Returns(true);

        var result = await _handler.Handle(new CancelAccountDeletionCommand("a@b.com", "pw"), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("NO_DELETION_PENDING", result.ErrorCode);
    }

    [Fact]
    public async Task Handle_ValidRequest_ReactivatesAccount()
    {
        var user = new User { UserId = Guid.NewGuid(), Email = "a@b.com", PasswordHash = "hash", DeletionRequestedAt = DateTime.UtcNow, IsActive = false };
        _users.Setup(r => r.GetByEmailAsync("a@b.com", default)).ReturnsAsync(user);
        _hasher.Setup(h => h.Verify("pw", "hash")).Returns(true);

        var result = await _handler.Handle(new CancelAccountDeletionCommand("A@B.COM", "pw"), default);

        Assert.True(result.IsSuccess);
        Assert.True(user.IsActive);
        Assert.Null(user.DeletionRequestedAt);
    }

    [Fact]
    public async Task Handle_LowercasesEmailBeforeLookup()
    {
        _users.Setup(r => r.GetByEmailAsync("a@b.com", default))
            .ReturnsAsync(new User { Email = "a@b.com", PasswordHash = "hash", DeletionRequestedAt = DateTime.UtcNow });
        _hasher.Setup(h => h.Verify("pw", "hash")).Returns(true);

        await _handler.Handle(new CancelAccountDeletionCommand("A@B.COM", "pw"), default);

        _users.Verify(r => r.GetByEmailAsync("a@b.com", default), Times.Once);
    }
}
