using Moq;
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
        _handler = new RefreshTokenCommandHandler(_uow.Object, _tokenService.Object, _requestContext.Object);
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
    public async Task Handle_ValidToken_ReturnsNewTokens()
    {
        var user = MakeUser();
        var token = MakeToken(user.UserId);
        _tokens.Setup(r => r.GetValidTokenAsync("valid-refresh", default)).ReturnsAsync(token);
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
        _tokens.Setup(r => r.GetValidTokenAsync(It.IsAny<string>(), default)).ReturnsAsync((RefreshToken?)null);

        var result = await _handler.Handle(new RefreshTokenCommand("invalid-token"), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("INVALID_REFRESH_TOKEN", result.ErrorCode);
    }

    [Fact]
    public async Task Handle_UserNotFound_ReturnsFailure()
    {
        var token = MakeToken(Guid.NewGuid());
        _tokens.Setup(r => r.GetValidTokenAsync("valid-refresh", default)).ReturnsAsync(token);
        _users.Setup(r => r.GetByIdAsync(token.UserId, default)).ReturnsAsync((User?)null);

        var result = await _handler.Handle(new RefreshTokenCommand("valid-refresh"), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("USER_NOT_FOUND", result.ErrorCode);
    }

    [Fact]
    public async Task Handle_OldTokenRevoked()
    {
        var user = MakeUser();
        var token = MakeToken(user.UserId);
        _tokens.Setup(r => r.GetValidTokenAsync("valid-refresh", default)).ReturnsAsync(token);
        _users.Setup(r => r.GetByIdAsync(user.UserId, default)).ReturnsAsync(user);
        _tokenService.Setup(t => t.GenerateAccessToken(user)).Returns("tok");
        _tokenService.Setup(t => t.GenerateRefreshToken()).Returns("ref");
        _tokens.Setup(r => r.AddAsync(It.IsAny<RefreshToken>(), default)).Returns(Task.CompletedTask);

        await _handler.Handle(new RefreshTokenCommand("valid-refresh"), default);

        Assert.True(token.IsRevoked);
        _tokens.Verify(r => r.Update(token), Times.Once);
    }
}
