using Moq;
using StudyPlatform.Application.Auth.Commands;
using StudyPlatform.Application.Security;
using StudyPlatform.Application.Security.Commands;
using StudyPlatform.Application.Services;
using StudyPlatform.Domain.Entities;
using StudyPlatform.Domain.Interfaces;
using Xunit;

namespace StudyPlatform.Tests.Security;

/// <summary>
/// The two legs of a 2FA login, and the guarantee that ties them together: the password leg alone
/// must never produce a usable token.
/// </summary>
public class TwoFactorLoginTests
{
    private readonly Mock<IUnitOfWork> _uow = new();
    private readonly Mock<IUserRepository> _users = new();
    private readonly Mock<IRefreshTokenRepository> _tokens = new();
    private readonly Mock<IUserTwoFactorRepository> _factors = new();
    private readonly Mock<ITokenService> _tokenService = new();
    private readonly Mock<IPasswordHasher> _hasher = new();
    private readonly Mock<ITotpService> _totp = new();
    private readonly Mock<IRequestContext> _requestContext = new();
    private readonly Mock<IAuditLogger> _audit = new();
    private readonly FakeCache _cache = new();

    private readonly Guid _userId = Guid.NewGuid();

    public TwoFactorLoginTests()
    {
        _uow.Setup(u => u.Users).Returns(_users.Object);
        _uow.Setup(u => u.RefreshTokens).Returns(_tokens.Object);
        _uow.Setup(u => u.UserTwoFactors).Returns(_factors.Object);
        _uow.Setup(u => u.SaveChangesAsync(default)).ReturnsAsync(1);
    }

    private User MakeUser() => new()
    {
        UserId = _userId,
        Email = "user@example.com",
        PasswordHash = "hashed",
        FullName = "Test User",
        IsEmailVerified = true,
        IsActive = true,
    };

    private UserTwoFactor MakeFactor(bool enabled = true) => new()
    {
        UserId = _userId,
        SecretBase32 = "JBSWY3DPEHPK3PXP",
        IsEnabled = enabled,
        RecoveryCodeHashesJson = "[]",
    };

    private LoginCommandHandler LoginHandler() => new(
        _uow.Object, _tokenService.Object, _hasher.Object, _cache, _requestContext.Object, _audit.Object);

    private VerifyTwoFactorLoginCommandHandler VerifyHandler() => new(
        _uow.Object, _cache, _totp.Object, _tokenService.Object, _hasher.Object,
        _requestContext.Object, _audit.Object);

    [Fact]
    public async Task Login_WithTwoFactorEnabled_IssuesChallengeAndNoTokens()
    {
        var user = MakeUser();
        _users.Setup(r => r.GetByEmailAsync("user@example.com", default)).ReturnsAsync(user);
        _hasher.Setup(h => h.Verify("password", "hashed")).Returns(true);
        _factors.Setup(r => r.GetByUserIdAsync(_userId, default)).ReturnsAsync(MakeFactor());

        var result = await LoginHandler().Handle(new LoginCommand("user@example.com", "password"), default);

        Assert.True(result.IsSuccess);
        Assert.True(result.Data!.TwoFactorRequired);
        Assert.NotNull(result.Data.ChallengeToken);

        // The whole point of the factor: a correct password buys no session.
        Assert.Empty(result.Data.AccessToken);
        Assert.Empty(result.Data.RefreshToken);
        _tokens.Verify(r => r.AddAsync(It.IsAny<RefreshToken>(), default), Times.Never);
    }

    [Fact]
    public async Task Login_WithPendingEnrolment_IssuesTokensNormally()
    {
        var user = MakeUser();
        _users.Setup(r => r.GetByEmailAsync("user@example.com", default)).ReturnsAsync(user);
        _hasher.Setup(h => h.Verify("password", "hashed")).Returns(true);
        // Setup started but never confirmed: it must not lock the user out of their own account.
        _factors.Setup(r => r.GetByUserIdAsync(_userId, default)).ReturnsAsync(MakeFactor(enabled: false));
        _tokenService.Setup(t => t.GenerateAccessToken(user)).Returns("access");
        _tokenService.Setup(t => t.GenerateRefreshToken()).Returns("refresh");

        var result = await LoginHandler().Handle(new LoginCommand("user@example.com", "password"), default);

        Assert.True(result.IsSuccess);
        Assert.False(result.Data!.TwoFactorRequired);
        Assert.Equal("access", result.Data.AccessToken);
    }

    [Fact]
    public async Task Verify_WithValidTotpCode_IssuesTokensAndBurnsTheChallenge()
    {
        var user = MakeUser();
        var factor = MakeFactor();
        var challenge = await TwoFactorChallenge.IssueAsync(_cache, _userId, default);

        _users.Setup(r => r.GetByIdAsync(_userId, default)).ReturnsAsync(user);
        _factors.Setup(r => r.GetByUserIdAsync(_userId, default)).ReturnsAsync(factor);
        _totp.Setup(t => t.Verify(factor.SecretBase32, "123456", 0)).Returns(999L);
        _tokenService.Setup(t => t.GenerateAccessToken(user)).Returns("access");
        _tokenService.Setup(t => t.GenerateRefreshToken()).Returns("refresh");

        var result = await VerifyHandler().Handle(new VerifyTwoFactorLoginCommand(challenge, "123456"), default);

        Assert.True(result.IsSuccess);
        Assert.Equal("access", result.Data!.AccessToken);
        Assert.Equal(999L, factor.LastUsedStep);

        // Burned, so an intercepted challenge cannot be redeemed for a second session.
        Assert.Null(await TwoFactorChallenge.ResolveAsync(_cache, challenge, default));
    }

    [Fact]
    public async Task Verify_WithRecoveryCode_SignsInAndSpendsTheCode()
    {
        var user = MakeUser();
        var factor = MakeFactor();

        var hasher = new Mock<IPasswordHasher>();
        hasher.Setup(h => h.Hash(It.IsAny<string>())).Returns((string s) => $"hash:{s}");
        hasher.Setup(h => h.Verify(It.IsAny<string>(), It.IsAny<string>()))
            .Returns((string plain, string hash) => hash == $"hash:{plain}");

        var codes = TwoFactorCodes.Generate();
        factor.RecoveryCodeHashesJson = TwoFactorCodes.HashAll(codes, hasher.Object);

        var challenge = await TwoFactorChallenge.IssueAsync(_cache, _userId, default);
        _users.Setup(r => r.GetByIdAsync(_userId, default)).ReturnsAsync(user);
        _factors.Setup(r => r.GetByUserIdAsync(_userId, default)).ReturnsAsync(factor);
        _totp.Setup(t => t.Verify(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<long>())).Returns((long?)null);
        _tokenService.Setup(t => t.GenerateAccessToken(user)).Returns("access");
        _tokenService.Setup(t => t.GenerateRefreshToken()).Returns("refresh");

        var handler = new VerifyTwoFactorLoginCommandHandler(
            _uow.Object, _cache, _totp.Object, _tokenService.Object, hasher.Object,
            _requestContext.Object, _audit.Object);

        var result = await handler.Handle(new VerifyTwoFactorLoginCommand(challenge, codes[0]), default);

        Assert.True(result.IsSuccess);
        Assert.Equal(
            TwoFactorCodes.CodeCount - 1,
            TwoFactorCodes.ReadHashes(factor.RecoveryCodeHashesJson).Count);
    }

    [Fact]
    public async Task Verify_WithBadCode_Fails()
    {
        var challenge = await TwoFactorChallenge.IssueAsync(_cache, _userId, default);
        _users.Setup(r => r.GetByIdAsync(_userId, default)).ReturnsAsync(MakeUser());
        _factors.Setup(r => r.GetByUserIdAsync(_userId, default)).ReturnsAsync(MakeFactor());
        _totp.Setup(t => t.Verify(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<long>())).Returns((long?)null);

        var result = await VerifyHandler().Handle(new VerifyTwoFactorLoginCommand(challenge, "000000"), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("INVALID_TOTP_CODE", result.ErrorCode);
        _tokens.Verify(r => r.AddAsync(It.IsAny<RefreshToken>(), default), Times.Never);
    }

    [Fact]
    public async Task Verify_WithUnknownChallenge_Fails()
    {
        var result = await VerifyHandler().Handle(
            new VerifyTwoFactorLoginCommand("no-such-challenge", "123456"), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("CHALLENGE_EXPIRED", result.ErrorCode);
    }

    /// <summary>
    /// Minutes can pass between the two legs. An account deactivated in the gap must not be able to
    /// finish the login it started.
    /// </summary>
    [Fact]
    public async Task Verify_WhenAccountDeactivatedBetweenLegs_Fails()
    {
        var user = MakeUser();
        user.IsActive = false;
        var challenge = await TwoFactorChallenge.IssueAsync(_cache, _userId, default);

        _users.Setup(r => r.GetByIdAsync(_userId, default)).ReturnsAsync(user);
        _factors.Setup(r => r.GetByUserIdAsync(_userId, default)).ReturnsAsync(MakeFactor());

        var result = await VerifyHandler().Handle(new VerifyTwoFactorLoginCommand(challenge, "123456"), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("CHALLENGE_EXPIRED", result.ErrorCode);
    }

    /// <summary>An in-memory <see cref="IAppCache"/>; the challenge store is the only thing under test.</summary>
    private sealed class FakeCache : IAppCache
    {
        private readonly Dictionary<string, object?> _entries = new();

        public Task<T?> GetAsync<T>(string key, CancellationToken cancellationToken = default)
            => Task.FromResult(_entries.TryGetValue(key, out var value) ? (T?)value : default);

        public Task SetAsync<T>(string key, T value, TimeSpan ttl, CancellationToken cancellationToken = default)
        {
            _entries[key] = value;
            return Task.CompletedTask;
        }

        public Task RemoveAsync(string key, CancellationToken cancellationToken = default)
        {
            _entries.Remove(key);
            return Task.CompletedTask;
        }

        public async Task<T> GetOrCreateAsync<T>(
            string key, Func<CancellationToken, Task<T>> factory, TimeSpan ttl,
            CancellationToken cancellationToken = default)
        {
            if (_entries.TryGetValue(key, out var existing))
                return (T)existing!;

            var created = await factory(cancellationToken);
            _entries[key] = created;
            return created;
        }
    }
}
