using Moq;
using StudyPlatform.Application.Auth;
using StudyPlatform.Application.Services;
using StudyPlatform.Domain.Entities;
using StudyPlatform.Domain.Interfaces;
using Xunit;

namespace StudyPlatform.Tests.Auth;

public class AuthSessionIssuerTests
{
    private readonly Mock<IUnitOfWork> _uow = new();
    private readonly Mock<IRefreshTokenRepository> _tokens = new();
    private readonly Mock<ITokenService> _tokenService = new();
    private readonly Mock<IRequestContext> _requestContext = new();
    private readonly AuthSessionIssuer _issuer;

    private readonly List<RefreshToken> _added = [];

    private readonly User _user = new()
    {
        UserId = Guid.NewGuid(),
        Email = "user@example.com",
        FullName = "Test User",
    };

    public AuthSessionIssuerTests()
    {
        _uow.Setup(u => u.RefreshTokens).Returns(_tokens.Object);
        _tokens.Setup(r => r.AddAsync(It.IsAny<RefreshToken>(), default))
            .Callback<RefreshToken, CancellationToken>((t, _) => _added.Add(t))
            .Returns(Task.CompletedTask);
        _tokenService.Setup(t => t.GenerateAccessToken(It.IsAny<User>())).Returns("access-token");
        _tokenService.Setup(t => t.GenerateRefreshToken()).Returns("refresh-token");
        _issuer = new AuthSessionIssuer(_uow.Object, _tokenService.Object, _requestContext.Object);
    }

    [Fact]
    public async Task IssueAsync_ReturnsTheMintedTokensAndTheUsersIdentity()
    {
        var response = await _issuer.IssueAsync(_user);

        Assert.Equal(_user.UserId, response.UserId);
        Assert.Equal("user@example.com", response.Email);
        Assert.Equal("Test User", response.FullName);
        Assert.Equal("access-token", response.AccessToken);
        Assert.Equal("refresh-token", response.RefreshToken);
    }

    [Fact]
    public async Task IssueAsync_PersistsTheRefreshTokenAndSavesOnce()
    {
        await _issuer.IssueAsync(_user);

        var token = Assert.Single(_added);
        Assert.Equal(_user.UserId, token.UserId);
        Assert.Equal("refresh-token", token.Token);
        Assert.False(token.IsRevoked);
        _uow.Verify(u => u.SaveChangesAsync(default), Times.Once);
    }

    [Fact]
    public async Task IssueAsync_ExpiryMatchesTheSharedAccessTokenLifetime()
    {
        var before = DateTime.UtcNow;

        var response = await _issuer.IssueAsync(_user);

        // The client schedules its silent refresh against this; it has to agree with the JWT's exp.
        Assert.InRange(
            response.AccessTokenExpiry,
            before.Add(AuthTokenLifetimes.AccessToken),
            DateTime.UtcNow.Add(AuthTokenLifetimes.AccessToken));
    }

    [Fact]
    public async Task IssueAsync_WithoutRotation_StartsANewSession()
    {
        await _issuer.IssueAsync(_user);
        await _issuer.IssueAsync(_user);

        Assert.Equal(2, _added.Count);
        Assert.NotEqual(_added[0].SessionId, _added[1].SessionId);
        Assert.All(_added, t => Assert.NotEqual(Guid.Empty, t.SessionId));
    }

    [Fact]
    public async Task IssueAsync_WhenRotating_KeepsTheSessionIdentity()
    {
        var rotating = new RefreshToken { SessionId = Guid.NewGuid(), UserId = _user.UserId };

        await _issuer.IssueAsync(_user, rotating);

        // A refresh every fifteen minutes must not show up as a new device in the session list.
        Assert.Equal(rotating.SessionId, Assert.Single(_added).SessionId);
    }

    [Fact]
    public async Task IssueAsync_WhenRotating_CarriesOverTheDeviceAnnotation()
    {
        _requestContext.SetupGet(c => c.DeviceName).Returns((string?)null);
        _requestContext.SetupGet(c => c.UserAgent).Returns((string?)null);
        _requestContext.SetupGet(c => c.IpAddress).Returns((string?)null);
        var rotating = new RefreshToken
        {
            SessionId = Guid.NewGuid(),
            DeviceName = "Ada's laptop",
            UserAgent = "Firefox",
            IpAddress = "203.0.113.7",
        };

        await _issuer.IssueAsync(_user, rotating);

        var token = Assert.Single(_added);
        Assert.Equal("Ada's laptop", token.DeviceName);
        Assert.Equal("Firefox", token.UserAgent);
        Assert.Equal("203.0.113.7", token.IpAddress);
    }

    [Fact]
    public async Task IssueAsync_WhenRotating_PrefersTheCurrentRequestOverTheOldAnnotation()
    {
        _requestContext.SetupGet(c => c.DeviceName).Returns("Ada's phone");
        var rotating = new RefreshToken { SessionId = Guid.NewGuid(), DeviceName = "Ada's laptop" };

        await _issuer.IssueAsync(_user, rotating);

        Assert.Equal("Ada's phone", Assert.Single(_added).DeviceName);
    }
}
