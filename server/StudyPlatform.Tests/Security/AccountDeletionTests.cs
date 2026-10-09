using Moq;
using StudyPlatform.Application.Security;
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
    private readonly RequestAccountDeletionCommandHandler _handler;
    private readonly Guid _userId = Guid.NewGuid();

    public RequestAccountDeletionCommandHandlerTests()
    {
        _uow.Setup(u => u.Users).Returns(_users.Object);
        _uow.Setup(u => u.RefreshTokens).Returns(_tokens.Object);
        _uow.Setup(u => u.SaveChangesAsync(default)).ReturnsAsync(1);
        _users.Setup(r => r.GetByIdAsync(_userId, default)).ReturnsAsync(new User { UserId = _userId, PasswordHash = "hash" });
        _tokens.Setup(r => r.RevokeAllUserTokensAsync(_userId, default)).Returns(Task.CompletedTask);
        _handler = new RequestAccountDeletionCommandHandler(_uow.Object, _hasher.Object);
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

public class PendingDeletionTests
{
    [Fact]
    public void CancelOnSignIn_PendingDeletion_ReactivatesTheAccount()
    {
        var user = new User { IsActive = false, DeletionRequestedAt = DateTime.UtcNow.AddDays(-2) };

        PendingDeletion.CancelOnSignIn(user);

        Assert.True(user.IsActive);
        Assert.Null(user.DeletionRequestedAt);
    }

    [Fact]
    public void CancelOnSignIn_DeactivatedWithoutDeletionRequest_StaysClosed()
    {
        // An admin deactivation never sets DeletionRequestedAt, so signing in must not undo it.
        var user = new User { IsActive = false };

        PendingDeletion.CancelOnSignIn(user);

        Assert.False(user.IsActive);
    }
}
