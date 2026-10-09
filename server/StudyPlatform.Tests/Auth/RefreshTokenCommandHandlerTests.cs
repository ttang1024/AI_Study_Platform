using Moq;
using StudyPlatform.Application.Auth;
using StudyPlatform.Application.Auth.Commands;
using StudyPlatform.Application.Services;
using StudyPlatform.Domain.Entities;
using StudyPlatform.Domain.Interfaces;
using Xunit;

namespace StudyPlatform.Tests.Auth;

public class RefreshTokenCommandHandlerTests
{
    private readonly Mock<IUnitOfWork> _uow = new();
    private readonly Mock<IUserRepository> _users = new();
    private readonly Mock<IRefreshTokenRepository> _tokens = new();
    private readonly Mock<ITokenService> _tokenService = new();
    private readonly Mock<IRequestContext> _requestContext = new();
    private readonly RefreshTokenCommandHandler _handler;

    public RefreshTokenCommandHandlerTests()
    {
        _uow.Setup(u => u.Users).Returns(_users.Object);
        _uow.Setup(u => u.RefreshTokens).Returns(_tokens.Object);
        _uow.Setup(u => u.SaveChangesAsync(default)).ReturnsAsync(1);
        _handler = new RefreshTokenCommandHandler(
            _uow.Object,
            new AuthSessionIssuer(_uow.Object, _tokenService.Object, _requestContext.Object));
    }

    private User MakeUser() => new()
    {
        UserId = Guid.NewGuid(),
        Email = "user@example.com",
        FullName = "Test User",
        PasswordHash = "hashed"
    };

    private RefreshToken MakeToken(Guid userId) => new()
    {
        TokenId = Guid.NewGuid(),
        UserId = userId,
        Token = "valid-refresh",
        ExpiresAt = DateTime.UtcNow.AddDays(7),
        IsRevoked = false
    };

    [Fact]
    public async Task Handle_DeactivatedUser_GetsNoNewTokens()
    {
        var user = MakeUser();
        user.IsActive = false;
        FindValid(MakeToken(user.UserId));
        _users.Setup(r => r.GetByIdAsync(user.UserId, default)).ReturnsAsync(user);

        var result = await _handler.Handle(new RefreshTokenCommand("valid-refresh"), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("ACCOUNT_DEACTIVATED", result.ErrorCode);
        _tokenService.Verify(t => t.GenerateAccessToken(It.IsAny<User>()), Times.Never);
    }

    [Fact]
    public async Task Handle_ValidToken_ReturnsNewTokens()
    {
        var user = MakeUser();
        var token = MakeToken(user.UserId);
        FindValid(token);
        _users.Setup(r => r.GetByIdAsync(user.UserId, default)).ReturnsAsync(user);
        _tokenService.Setup(t => t.GenerateAccessToken(user)).Returns("new-access");
        _tokenService.Setup(t => t.GenerateRefreshToken()).Returns("new-refresh");
        _tokens.Setup(r => r.AddAsync(It.IsAny<RefreshToken>(), default)).Returns(Task.CompletedTask);

        var result = await _handler.Handle(new RefreshTokenCommand("valid-refresh"), default);

        Assert.True(result.IsSuccess);
        Assert.Equal("new-access", result.Data!.AccessToken);
        Assert.Equal("new-refresh", result.Data.RefreshToken);
    }

    [Fact]
    public async Task Handle_InvalidToken_ReturnsFailure()
    {
        _tokens.Setup(r => r.FindByHashAsync(It.IsAny<string>(), default)).ReturnsAsync((RefreshToken?)null);

        var result = await _handler.Handle(new RefreshTokenCommand("invalid-token"), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("INVALID_REFRESH_TOKEN", result.ErrorCode);
    }

    [Fact]
    public async Task Handle_UserNotFound_ReturnsFailure()
    {
        var token = MakeToken(Guid.NewGuid());
        FindValid(token);
        _users.Setup(r => r.GetByIdAsync(token.UserId, default)).ReturnsAsync((User?)null);

        var result = await _handler.Handle(new RefreshTokenCommand("valid-refresh"), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("USER_NOT_FOUND", result.ErrorCode);
    }

    [Fact]
    public async Task Handle_OldTokenIsClaimedAtomically()
    {
        var user = MakeUser();
        var token = MakeToken(user.UserId);
        FindValid(token);
        _users.Setup(r => r.GetByIdAsync(user.UserId, default)).ReturnsAsync(user);
        _tokenService.Setup(t => t.GenerateAccessToken(user)).Returns("tok");
        _tokenService.Setup(t => t.GenerateRefreshToken()).Returns("ref");

        await _handler.Handle(new RefreshTokenCommand("valid-refresh"), default);

        _tokens.Verify(r => r.TryRevokeAsync(token.TokenId, default), Times.Once);
    }

    [Fact]
    public async Task Handle_LosingAConcurrentRefresh_IssuesNothing()
    {
        var user = MakeUser();
        var token = MakeToken(user.UserId);
        FindValid(token);
        _users.Setup(r => r.GetByIdAsync(user.UserId, default)).ReturnsAsync(user);
        _tokens.Setup(r => r.TryRevokeAsync(token.TokenId, default)).ReturnsAsync(false);

        var result = await _handler.Handle(new RefreshTokenCommand("valid-refresh"), default);

        Assert.Equal("INVALID_REFRESH_TOKEN", result.ErrorCode);
        _tokens.Verify(r => r.AddAsync(It.IsAny<RefreshToken>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task Handle_RotatedTokenReplayedLater_RevokesTheWholeSession()
    {
        var token = MakeToken(Guid.NewGuid());
        token.IsRevoked = true;
        token.RevokedAt = DateTime.UtcNow.AddMinutes(-5);
        FindValid(token);

        var result = await _handler.Handle(new RefreshTokenCommand("valid-refresh"), default);

        Assert.False(result.IsSuccess);
        _tokens.Verify(r => r.RevokeSessionAsync(token.UserId, token.SessionId, default), Times.Once);
    }

    [Fact]
    public async Task Handle_RotatedTokenWithinGrace_FailsWithoutRevokingTheSession()
    {
        // Two tabs refreshing in the same instant: the slower one carries the just-rotated token.
        var token = MakeToken(Guid.NewGuid());
        token.IsRevoked = true;
        token.RevokedAt = DateTime.UtcNow.AddSeconds(-2);
        FindValid(token);

        var result = await _handler.Handle(new RefreshTokenCommand("valid-refresh"), default);

        Assert.False(result.IsSuccess);
        _tokens.Verify(r => r.RevokeSessionAsync(It.IsAny<Guid>(), It.IsAny<Guid>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task IssuedTokens_AreStoredHashed()
    {
        var user = MakeUser();
        FindValid(MakeToken(user.UserId));
        _users.Setup(r => r.GetByIdAsync(user.UserId, default)).ReturnsAsync(user);
        _tokenService.Setup(t => t.GenerateRefreshToken()).Returns("plain-new-refresh");
        RefreshToken? stored = null;
        _tokens.Setup(r => r.AddAsync(It.IsAny<RefreshToken>(), default))
            .Callback<RefreshToken, CancellationToken>((t, _) => stored = t);

        var result = await _handler.Handle(new RefreshTokenCommand("valid-refresh"), default);

        Assert.Equal("plain-new-refresh", result.Data!.RefreshToken);
        Assert.Equal(RefreshTokenHash.Compute("plain-new-refresh"), stored!.Token);
        Assert.DoesNotContain("plain", stored.Token);
    }

    private void FindValid(RefreshToken token)
    {
        _tokens.Setup(r => r.FindByHashAsync(RefreshTokenHash.Compute("valid-refresh"), default)).ReturnsAsync(token);
        _tokens.Setup(r => r.TryRevokeAsync(token.TokenId, default)).ReturnsAsync(true);
    }
}
