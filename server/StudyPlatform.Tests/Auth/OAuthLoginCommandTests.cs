using Moq;
using StudyPlatform.Application.Auth.Commands;
using StudyPlatform.Application.Services;
using StudyPlatform.Domain.Entities;
using StudyPlatform.Domain.Interfaces;
using Xunit;

namespace StudyPlatform.Tests.Auth;

public class OAuthLoginCommandHandlerTests
{
    private readonly Mock<IUnitOfWork> _uow = new();
    private readonly Mock<IUserRepository> _users = new();
    private readonly Mock<IRefreshTokenRepository> _tokens = new();
    private readonly Mock<ITokenService> _tokenService = new();
    private readonly Mock<IOAuthService> _oAuthService = new();
    private readonly Mock<IRequestContext> _requestContext = new();
    private readonly OAuthLoginCommandHandler _handler;

    public OAuthLoginCommandHandlerTests()
    {
        _uow.Setup(u => u.Users).Returns(_users.Object);
        _uow.Setup(u => u.RefreshTokens).Returns(_tokens.Object);
        _users.Setup(r => r.AddAsync(It.IsAny<User>(), default)).Returns(Task.CompletedTask);
        _tokens.Setup(r => r.AddAsync(It.IsAny<RefreshToken>(), default)).Returns(Task.CompletedTask);
        _tokenService.Setup(t => t.GenerateAccessToken(It.IsAny<User>())).Returns("access-token");
        _tokenService.Setup(t => t.GenerateRefreshToken()).Returns("refresh-token");
        _handler = new OAuthLoginCommandHandler(_uow.Object, _tokenService.Object, _oAuthService.Object, _requestContext.Object);
    }

    [Fact]
    public async Task Handle_OAuthProviderFails_ReturnsFailure()
    {
        _oAuthService.Setup(o => o.GetUserInfoAsync("google", "code", "redirect", default)).ReturnsAsync((OAuthUserInfo?)null);

        var result = await _handler.Handle(new OAuthLoginCommand("google", "code", "redirect"), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("OAUTH_FAILED", result.ErrorCode);
    }

    [Fact]
    public async Task Handle_NewUser_CreatesAccountAndLogsIn()
    {
        _oAuthService.Setup(o => o.GetUserInfoAsync("google", "code", "redirect", default))
            .ReturnsAsync(new OAuthUserInfo("New@Example.com", "New User"));
        _users.Setup(r => r.GetByEmailAsync("new@example.com", default)).ReturnsAsync((User?)null);

        var result = await _handler.Handle(new OAuthLoginCommand("google", "code", "redirect"), default);

        Assert.True(result.IsSuccess);
        Assert.Equal("new@example.com", result.Data!.Email);
        _users.Verify(r => r.AddAsync(It.IsAny<User>(), default), Times.Once);
    }

    [Fact]
    public async Task Handle_ExistingUser_DoesNotCreateNewAccount()
    {
        var existing = new User { UserId = Guid.NewGuid(), Email = "existing@example.com", FullName = "Existing", IsActive = true };
        _oAuthService.Setup(o => o.GetUserInfoAsync("google", "code", "redirect", default))
            .ReturnsAsync(new OAuthUserInfo("existing@example.com", "Existing"));
        _users.Setup(r => r.GetByEmailAsync("existing@example.com", default)).ReturnsAsync(existing);

        var result = await _handler.Handle(new OAuthLoginCommand("google", "code", "redirect"), default);

        Assert.True(result.IsSuccess);
        _users.Verify(r => r.AddAsync(It.IsAny<User>(), default), Times.Never);
    }

    [Fact]
    public async Task Handle_DeactivatedAccount_ReturnsFailure()
    {
        var existing = new User { UserId = Guid.NewGuid(), Email = "existing@example.com", FullName = "Existing", IsActive = false };
        _oAuthService.Setup(o => o.GetUserInfoAsync("google", "code", "redirect", default))
            .ReturnsAsync(new OAuthUserInfo("existing@example.com", "Existing"));
        _users.Setup(r => r.GetByEmailAsync("existing@example.com", default)).ReturnsAsync(existing);

        var result = await _handler.Handle(new OAuthLoginCommand("google", "code", "redirect"), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("ACCOUNT_DEACTIVATED", result.ErrorCode);
    }

    [Fact]
    public async Task Handle_ValidLogin_PersistsRefreshToken()
    {
        _oAuthService.Setup(o => o.GetUserInfoAsync("google", "code", "redirect", default))
            .ReturnsAsync(new OAuthUserInfo("new@example.com", "New User"));
        _users.Setup(r => r.GetByEmailAsync("new@example.com", default)).ReturnsAsync((User?)null);

        var result = await _handler.Handle(new OAuthLoginCommand("google", "code", "redirect"), default);

        Assert.True(result.IsSuccess);
        Assert.Equal("refresh-token", result.Data!.RefreshToken);
        _tokens.Verify(r => r.AddAsync(It.IsAny<RefreshToken>(), default), Times.Once);
        _uow.Verify(u => u.SaveChangesAsync(default), Times.Once);
    }
}

public class GoogleCredentialLoginCommandHandlerTests
{
    private readonly Mock<IUnitOfWork> _uow = new();
    private readonly Mock<IUserRepository> _users = new();
    private readonly Mock<IRefreshTokenRepository> _tokens = new();
    private readonly Mock<ITokenService> _tokenService = new();
    private readonly Mock<IOAuthService> _oAuthService = new();
    private readonly Mock<IRequestContext> _requestContext = new();
    private readonly GoogleCredentialLoginCommandHandler _handler;

    public GoogleCredentialLoginCommandHandlerTests()
    {
        _uow.Setup(u => u.Users).Returns(_users.Object);
        _uow.Setup(u => u.RefreshTokens).Returns(_tokens.Object);
        _users.Setup(r => r.AddAsync(It.IsAny<User>(), default)).Returns(Task.CompletedTask);
        _tokens.Setup(r => r.AddAsync(It.IsAny<RefreshToken>(), default)).Returns(Task.CompletedTask);
        _tokenService.Setup(t => t.GenerateAccessToken(It.IsAny<User>())).Returns("access-token");
        _tokenService.Setup(t => t.GenerateRefreshToken()).Returns("refresh-token");
        _handler = new GoogleCredentialLoginCommandHandler(_uow.Object, _tokenService.Object, _oAuthService.Object, _requestContext.Object);
    }

    [Fact]
    public async Task Handle_InvalidCredential_ReturnsFailure()
    {
        _oAuthService.Setup(o => o.GetGoogleUserInfoFromCredentialAsync("bad-credential", default)).ReturnsAsync((OAuthUserInfo?)null);

        var result = await _handler.Handle(new GoogleCredentialLoginCommand("bad-credential"), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("GOOGLE_CREDENTIAL_FAILED", result.ErrorCode);
    }

    [Fact]
    public async Task Handle_NewUser_CreatesAccount()
    {
        _oAuthService.Setup(o => o.GetGoogleUserInfoFromCredentialAsync("cred", default))
            .ReturnsAsync(new OAuthUserInfo("new@example.com", "New User"));
        _users.Setup(r => r.GetByEmailAsync("new@example.com", default)).ReturnsAsync((User?)null);

        var result = await _handler.Handle(new GoogleCredentialLoginCommand("cred"), default);

        Assert.True(result.IsSuccess);
        _users.Verify(r => r.AddAsync(It.IsAny<User>(), default), Times.Once);
    }

    [Fact]
    public async Task Handle_DeactivatedAccount_ReturnsFailure()
    {
        var existing = new User { UserId = Guid.NewGuid(), Email = "existing@example.com", FullName = "Existing", IsActive = false };
        _oAuthService.Setup(o => o.GetGoogleUserInfoFromCredentialAsync("cred", default))
            .ReturnsAsync(new OAuthUserInfo("existing@example.com", "Existing"));
        _users.Setup(r => r.GetByEmailAsync("existing@example.com", default)).ReturnsAsync(existing);

        var result = await _handler.Handle(new GoogleCredentialLoginCommand("cred"), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("ACCOUNT_DEACTIVATED", result.ErrorCode);
    }
}
