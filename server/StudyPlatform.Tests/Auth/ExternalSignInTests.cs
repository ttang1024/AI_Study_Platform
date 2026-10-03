using Moq;
using StudyPlatform.Application.Auth;
using StudyPlatform.Application.Auth.DTOs;
using StudyPlatform.Application.Services;
using StudyPlatform.Domain.Entities;
using StudyPlatform.Domain.Interfaces;
using Xunit;

namespace StudyPlatform.Tests.Auth;

public class ExternalSignInTests
{
    private readonly Mock<IUnitOfWork> _uow = new();
    private readonly Mock<IUserRepository> _users = new();
    private readonly Mock<IAuthSessionIssuer> _issuer = new();
    private readonly ExternalSignIn _signIn;

    private readonly List<User> _added = [];

    public ExternalSignInTests()
    {
        _uow.Setup(u => u.Users).Returns(_users.Object);
        _users.Setup(r => r.AddAsync(It.IsAny<User>(), default))
            .Callback<User, CancellationToken>((u, _) => _added.Add(u))
            .Returns(Task.CompletedTask);
        _issuer.Setup(i => i.IssueAsync(It.IsAny<User>(), null, default))
            .ReturnsAsync((User u, RefreshToken? _, CancellationToken _) =>
                new AuthResponse(u.UserId, u.Email, u.FullName, "access", "refresh", DateTime.UtcNow));
        _signIn = new ExternalSignIn(_uow.Object, _issuer.Object);
    }

    private void ExistingUser(User? user) =>
        _users.Setup(r => r.GetByEmailAsync(It.IsAny<string>(), default)).ReturnsAsync(user);

    [Fact]
    public async Task CompleteAsync_UnknownEmail_ProvisionsAVerifiedPasswordlessAccount()
    {
        ExistingUser(null);

        var result = await _signIn.CompleteAsync(new OAuthUserInfo("new@example.com", "New User"));

        Assert.True(result.IsSuccess);
        var user = Assert.Single(_added);
        Assert.Equal("new@example.com", user.Email);
        Assert.Equal("New User", user.FullName);
        // The provider vouched for the address and there is no local password to set.
        Assert.True(user.IsEmailVerified);
        Assert.True(user.IsActive);
        Assert.Equal(string.Empty, user.PasswordHash);
    }

    [Fact]
    public async Task CompleteAsync_LooksUpAndStoresTheEmailLowercased()
    {
        ExistingUser(null);

        await _signIn.CompleteAsync(new OAuthUserInfo("Mixed@Example.COM", "Mixed"));

        _users.Verify(r => r.GetByEmailAsync("mixed@example.com", default), Times.Once);
        Assert.Equal("mixed@example.com", Assert.Single(_added).Email);
    }

    [Fact]
    public async Task CompleteAsync_KnownEmail_SignsInWithoutCreatingASecondAccount()
    {
        var existing = new User
        {
            UserId = Guid.NewGuid(), Email = "existing@example.com", FullName = "Existing", IsActive = true,
        };
        ExistingUser(existing);

        var result = await _signIn.CompleteAsync(new OAuthUserInfo("existing@example.com", "Existing"));

        Assert.True(result.IsSuccess);
        Assert.Equal(existing.UserId, result.Data!.UserId);
        Assert.Empty(_added);
    }

    [Fact]
    public async Task CompleteAsync_DeactivatedAccount_FailsAndIssuesNoSession()
    {
        ExistingUser(new User
        {
            UserId = Guid.NewGuid(), Email = "existing@example.com", FullName = "Existing", IsActive = false,
        });

        var result = await _signIn.CompleteAsync(new OAuthUserInfo("existing@example.com", "Existing"));

        Assert.False(result.IsSuccess);
        Assert.Equal("ACCOUNT_DEACTIVATED", result.ErrorCode);
        _issuer.Verify(i => i.IssueAsync(It.IsAny<User>(), It.IsAny<RefreshToken?>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task CompleteAsync_IssuesTheSessionForTheResolvedUser()
    {
        var existing = new User
        {
            UserId = Guid.NewGuid(), Email = "existing@example.com", FullName = "Existing", IsActive = true,
        };
        ExistingUser(existing);

        await _signIn.CompleteAsync(new OAuthUserInfo("existing@example.com", "Existing"));

        _issuer.Verify(i => i.IssueAsync(existing, null, default), Times.Once);
    }
}
