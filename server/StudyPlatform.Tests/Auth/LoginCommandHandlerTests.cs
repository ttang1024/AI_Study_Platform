using Moq;
using StudyPlatform.Application.Auth;
using StudyPlatform.Application.Auth.Commands;
using StudyPlatform.Application.Services;
using StudyPlatform.Domain.Entities;
using StudyPlatform.Domain.Interfaces;
using StudyPlatform.Tests.TestSupport;
using Xunit;

namespace StudyPlatform.Tests.Auth;

public class LoginCommandHandlerTests
{
    private readonly Mock<IUnitOfWork> _uow = new();
    private readonly Mock<IUserRepository> _users = new();
    private readonly Mock<IRefreshTokenRepository> _tokens = new();
    private readonly Mock<ITokenService> _tokenService = new();
    private readonly Mock<IPasswordHasher> _hasher = new();
    private readonly Mock<IRequestContext> _requestContext = new();
    private readonly LoginThrottle _throttle = new(new InMemoryAppCache());
    private readonly LoginCommandHandler _handler;

    public LoginCommandHandlerTests()
    {
        _handler = new LoginCommandHandler(
            _users.Object, _hasher.Object,
            new AuthSessionIssuer(_uow.Object, _users.Object, _tokens.Object, _tokenService.Object, _requestContext.Object),
            _throttle);
    }

    private User MakeUser(bool verified = true, bool active = true) => new()
    {
        UserId = Guid.NewGuid(),
        Email = "user@example.com",
        PasswordHash = "hashed",
        FullName = "Test User",
        IsEmailVerified = verified,
        IsActive = active,
    };

    [Fact]
    public async Task Handle_ValidCredentials_ReturnsSuccess()
    {
        var user = MakeUser();
        _users.Setup(r => r.GetByEmailAsync("user@example.com", default)).ReturnsAsync(user);
        _hasher.Setup(h => h.Verify("password", "hashed")).Returns(true);
        _tokenService.Setup(t => t.GenerateAccessToken(user)).Returns("access-token");
        _tokenService.Setup(t => t.GenerateRefreshToken()).Returns("refresh-token");
        _tokens.Setup(r => r.AddAsync(It.IsAny<RefreshToken>(), default)).Returns(Task.CompletedTask);
        _uow.Setup(u => u.SaveChangesAsync(default)).ReturnsAsync(1);

        var result = await _handler.Handle(new LoginCommand("user@example.com", "password"), default);

        Assert.True(result.IsSuccess);
        Assert.NotNull(result.Data);
        Assert.Equal("access-token", result.Data.AccessToken);
        Assert.Equal("refresh-token", result.Data.RefreshToken);
        Assert.Equal(user.UserId, result.Data.UserId);
    }

    [Fact]
    public async Task Handle_PendingDeletion_CancelsItAndSignsIn()
    {
        var user = MakeUser(active: false);
        user.DeletionRequestedAt = DateTime.UtcNow.AddDays(-1);
        _users.Setup(r => r.GetByEmailAsync("user@example.com", default)).ReturnsAsync(user);
        _hasher.Setup(h => h.Verify("password", "hashed")).Returns(true);
        _tokenService.Setup(t => t.GenerateRefreshToken()).Returns("refresh-token");
        _uow.Setup(u => u.SaveChangesAsync(default)).ReturnsAsync(1);

        var result = await _handler.Handle(new LoginCommand("user@example.com", "password"), default);

        Assert.True(result.IsSuccess);
        Assert.True(user.IsActive);
        Assert.Null(user.DeletionRequestedAt);
    }

    [Fact]
    public async Task Handle_PendingDeletion_WrongPassword_LeavesItScheduled()
    {
        var user = MakeUser(active: false);
        user.DeletionRequestedAt = DateTime.UtcNow.AddDays(-1);
        _users.Setup(r => r.GetByEmailAsync("user@example.com", default)).ReturnsAsync(user);
        _hasher.Setup(h => h.Verify("wrong", "hashed")).Returns(false);

        var result = await _handler.Handle(new LoginCommand("user@example.com", "wrong"), default);

        Assert.False(result.IsSuccess);
        Assert.False(user.IsActive);
        Assert.NotNull(user.DeletionRequestedAt);
    }

    [Fact]
    public async Task Handle_UserNotFound_ReturnsFailure()
    {
        _users.Setup(r => r.GetByEmailAsync(It.IsAny<string>(), default)).ReturnsAsync((User?)null);

        var result = await _handler.Handle(new LoginCommand("missing@x.com", "pass"), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("INVALID_CREDENTIALS", result.ErrorCode);
    }

    [Fact]
    public async Task Handle_WrongPassword_ReturnsFailure()
    {
        var user = MakeUser();
        _users.Setup(r => r.GetByEmailAsync("user@example.com", default)).ReturnsAsync(user);
        _hasher.Setup(h => h.Verify("wrong", "hashed")).Returns(false);

        var result = await _handler.Handle(new LoginCommand("user@example.com", "wrong"), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("INVALID_CREDENTIALS", result.ErrorCode);
    }

    [Fact]
    public async Task Handle_EmailNotVerified_ReturnsFailure()
    {
        var user = MakeUser(verified: false);
        _users.Setup(r => r.GetByEmailAsync("user@example.com", default)).ReturnsAsync(user);
        _hasher.Setup(h => h.Verify("password", "hashed")).Returns(true);

        var result = await _handler.Handle(new LoginCommand("user@example.com", "password"), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("EMAIL_NOT_VERIFIED", result.ErrorCode);
    }

    [Fact]
    public async Task Handle_AccountDeactivated_ReturnsFailure()
    {
        var user = MakeUser(active: false);
        _users.Setup(r => r.GetByEmailAsync("user@example.com", default)).ReturnsAsync(user);
        _hasher.Setup(h => h.Verify("password", "hashed")).Returns(true);

        var result = await _handler.Handle(new LoginCommand("user@example.com", "password"), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("ACCOUNT_DEACTIVATED", result.ErrorCode);
    }

    [Fact]
    public async Task Handle_EmailLookupIsCaseInsensitive()
    {
        var user = MakeUser();
        _users.Setup(r => r.GetByEmailAsync("user@example.com", default)).ReturnsAsync(user);
        _hasher.Setup(h => h.Verify("password", "hashed")).Returns(true);
        _tokenService.Setup(t => t.GenerateAccessToken(user)).Returns("tok");
        _tokenService.Setup(t => t.GenerateRefreshToken()).Returns("ref");
        _tokens.Setup(r => r.AddAsync(It.IsAny<RefreshToken>(), default)).Returns(Task.CompletedTask);
        _uow.Setup(u => u.SaveChangesAsync(default)).ReturnsAsync(1);

        // Email passed as uppercase should be lowercased before lookup
        var result = await _handler.Handle(new LoginCommand("USER@EXAMPLE.COM", "password"), default);

        _users.Verify(r => r.GetByEmailAsync("user@example.com", default), Times.Once);
        Assert.True(result.IsSuccess);
    }

    [Fact]
    public async Task Handle_LocksTheAccountAfterRepeatedFailures_EvenWithTheRightPassword()
    {
        var user = MakeUser();
        _users.Setup(r => r.GetByEmailAsync("user@example.com", default)).ReturnsAsync(user);
        _hasher.Setup(h => h.Verify("wrong", "hashed")).Returns(false);
        _hasher.Setup(h => h.Verify("right", "hashed")).Returns(true);

        for (var i = 0; i < LoginThrottle.MaxFailedAttempts; i++)
            await _handler.Handle(new LoginCommand("user@example.com", "wrong"), default);

        var result = await _handler.Handle(new LoginCommand("USER@example.com", "right"), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("TOO_MANY_ATTEMPTS", result.ErrorCode);
    }

    [Fact]
    public async Task Handle_UnknownEmail_CountsTowardsTheLockout_SoLockoutRevealsNothing()
    {
        _users.Setup(r => r.GetByEmailAsync("ghost@example.com", default)).ReturnsAsync((User?)null);
        _hasher.Setup(h => h.Hash(It.IsAny<string>())).Returns("dummy");

        for (var i = 0; i < LoginThrottle.MaxFailedAttempts; i++)
            await _handler.Handle(new LoginCommand("ghost@example.com", "pw"), default);

        var result = await _handler.Handle(new LoginCommand("ghost@example.com", "pw"), default);
        Assert.Equal("TOO_MANY_ATTEMPTS", result.ErrorCode);
    }

    [Fact]
    public async Task Handle_SuccessfulSignIn_ClearsEarlierFailures()
    {
        var user = MakeUser();
        _users.Setup(r => r.GetByEmailAsync("user@example.com", default)).ReturnsAsync(user);
        _hasher.Setup(h => h.Verify("wrong", "hashed")).Returns(false);
        _hasher.Setup(h => h.Verify("right", "hashed")).Returns(true);
        _tokenService.Setup(t => t.GenerateAccessToken(user)).Returns("access");
        _tokenService.Setup(t => t.GenerateRefreshToken()).Returns("refresh");

        for (var i = 0; i < LoginThrottle.MaxFailedAttempts - 1; i++)
            await _handler.Handle(new LoginCommand("user@example.com", "wrong"), default);
        Assert.True((await _handler.Handle(new LoginCommand("user@example.com", "right"), default)).IsSuccess);

        await _handler.Handle(new LoginCommand("user@example.com", "wrong"), default);
        Assert.False(await _throttle.IsLockedOutAsync("user@example.com"));
    }
}
