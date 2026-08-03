using Moq;
using StudyPlatform.Application.Auth.Commands;
using StudyPlatform.Application.Services;
using StudyPlatform.Domain.Entities;
using StudyPlatform.Domain.Interfaces;
using Xunit;

namespace StudyPlatform.Tests.Auth;

public class LoginCommandHandlerTests
{
    private readonly Mock<IUnitOfWork> _uow = new();
    private readonly Mock<IUserRepository> _users = new();
    private readonly Mock<IRefreshTokenRepository> _tokens = new();
    private readonly Mock<ITokenService> _tokenService = new();
    private readonly Mock<IPasswordHasher> _hasher = new();
    private readonly Mock<IAppCache> _cache = new();
    private readonly Mock<IRequestContext> _requestContext = new();
    private readonly Mock<IAuditLogger> _audit = new();
    private readonly Mock<IUserTwoFactorRepository> _twoFactors = new();
    private readonly LoginCommandHandler _handler;

    public LoginCommandHandlerTests()
    {
        _uow.Setup(u => u.Users).Returns(_users.Object);
        _uow.Setup(u => u.RefreshTokens).Returns(_tokens.Object);
        _uow.Setup(u => u.UserTwoFactors).Returns(_twoFactors.Object);
        _handler = new LoginCommandHandler(
            _uow.Object, _tokenService.Object, _hasher.Object,
            _cache.Object, _requestContext.Object, _audit.Object);
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
}
