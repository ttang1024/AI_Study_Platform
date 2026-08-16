using Moq;
using StudyPlatform.Application.Security;
using StudyPlatform.Application.Security.Commands;
using StudyPlatform.Application.Security.Queries;
using StudyPlatform.Application.Services;
using StudyPlatform.Domain.Entities;
using StudyPlatform.Domain.Interfaces;
using Xunit;

namespace StudyPlatform.Tests.Security;

public class GetTwoFactorStatusQueryHandlerTests
{
    private readonly Mock<IUnitOfWork> _uow = new();
    private readonly Mock<IUserTwoFactorRepository> _factors = new();
    private readonly GetTwoFactorStatusQueryHandler _handler;
    private readonly Guid _userId = Guid.NewGuid();

    public GetTwoFactorStatusQueryHandlerTests()
    {
        _uow.Setup(u => u.UserTwoFactors).Returns(_factors.Object);
        _handler = new GetTwoFactorStatusQueryHandler(_uow.Object);
    }

    [Fact]
    public async Task Handle_NoFactorRow_ReturnsDisabled()
    {
        _factors.Setup(r => r.GetByUserIdAsync(_userId, default)).ReturnsAsync((UserTwoFactor?)null);

        var result = await _handler.Handle(new GetTwoFactorStatusQuery(_userId), default);

        Assert.True(result.IsSuccess);
        Assert.False(result.Data!.Enabled);
        Assert.Equal(0, result.Data.RecoveryCodesRemaining);
    }

    [Fact]
    public async Task Handle_PendingEnrolment_ReadsAsDisabled()
    {
        _factors.Setup(r => r.GetByUserIdAsync(_userId, default))
            .ReturnsAsync(new UserTwoFactor { UserId = _userId, IsEnabled = false, SecretBase32 = "SECRET" });

        var result = await _handler.Handle(new GetTwoFactorStatusQuery(_userId), default);

        Assert.False(result.Data!.Enabled);
    }

    [Fact]
    public async Task Handle_Enabled_ReturnsEnabledAtAndRecoveryCodeCount()
    {
        var enabledAt = DateTime.UtcNow;
        var hashesJson = TwoFactorCodes.WriteHashes(new[] { "hash1", "hash2", "hash3" });
        _factors.Setup(r => r.GetByUserIdAsync(_userId, default))
            .ReturnsAsync(new UserTwoFactor { UserId = _userId, IsEnabled = true, EnabledAt = enabledAt, RecoveryCodeHashesJson = hashesJson });

        var result = await _handler.Handle(new GetTwoFactorStatusQuery(_userId), default);

        Assert.True(result.Data!.Enabled);
        Assert.Equal(enabledAt, result.Data.EnabledAt);
        Assert.Equal(3, result.Data.RecoveryCodesRemaining);
    }
}

public class GetSessionsQueryHandlerTests
{
    private readonly Mock<IUnitOfWork> _uow = new();
    private readonly Mock<IRefreshTokenRepository> _tokens = new();
    private readonly GetSessionsQueryHandler _handler;
    private readonly Guid _userId = Guid.NewGuid();

    public GetSessionsQueryHandlerTests()
    {
        _uow.Setup(u => u.RefreshTokens).Returns(_tokens.Object);
        _handler = new GetSessionsQueryHandler(_uow.Object);
    }

    [Fact]
    public async Task Handle_MapsActiveSessionsToDtos()
    {
        var sessionId = Guid.NewGuid();
        _tokens.Setup(r => r.GetActiveSessionsAsync(_userId, "current-token", default))
            .ReturnsAsync(new[] { new ActiveSession(sessionId, "iPhone", "1.2.3.4", DateTime.UtcNow, null, DateTime.UtcNow.AddDays(30), true) });

        var result = await _handler.Handle(new GetSessionsQuery(_userId, "current-token"), default);

        Assert.True(result.IsSuccess);
        var dto = Assert.Single(result.Data!);
        Assert.Equal(sessionId, dto.SessionId);
        Assert.True(dto.IsCurrent);
    }
}

public class RevokeSessionCommandHandlerTests
{
    private readonly Mock<IUnitOfWork> _uow = new();
    private readonly Mock<IRefreshTokenRepository> _tokens = new();
    private readonly Mock<IAuditLogger> _audit = new();
    private readonly RevokeSessionCommandHandler _handler;
    private readonly Guid _userId = Guid.NewGuid();
    private readonly Guid _sessionId = Guid.NewGuid();

    public RevokeSessionCommandHandlerTests()
    {
        _uow.Setup(u => u.RefreshTokens).Returns(_tokens.Object);
        _uow.Setup(u => u.SaveChangesAsync(default)).ReturnsAsync(1);
        _handler = new RevokeSessionCommandHandler(_uow.Object, _audit.Object);
    }

    [Fact]
    public async Task Handle_SessionNotFound_ReturnsFailure()
    {
        _tokens.Setup(r => r.RevokeSessionAsync(_userId, _sessionId, default)).ReturnsAsync(false);

        var result = await _handler.Handle(new RevokeSessionCommand(_userId, _sessionId), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("SESSION_NOT_FOUND", result.ErrorCode);
        _audit.Verify(a => a.LogAsync(It.IsAny<string>(), It.IsAny<Guid?>(), It.IsAny<Guid?>(), It.IsAny<string?>(), It.IsAny<string?>(), It.IsAny<object?>(), default), Times.Never);
    }

    [Fact]
    public async Task Handle_SessionFound_RevokesAndAudits()
    {
        _tokens.Setup(r => r.RevokeSessionAsync(_userId, _sessionId, default)).ReturnsAsync(true);

        var result = await _handler.Handle(new RevokeSessionCommand(_userId, _sessionId), default);

        Assert.True(result.IsSuccess);
        _audit.Verify(a => a.LogAsync(AuditActions.SessionRevoked, _userId, null, "Session", _sessionId.ToString(), null, default), Times.Once);
    }
}

public class RevokeOtherSessionsCommandHandlerTests
{
    private readonly Mock<IUnitOfWork> _uow = new();
    private readonly Mock<IRefreshTokenRepository> _tokens = new();
    private readonly Mock<IAuditLogger> _audit = new();
    private readonly RevokeOtherSessionsCommandHandler _handler;
    private readonly Guid _userId = Guid.NewGuid();

    public RevokeOtherSessionsCommandHandlerTests()
    {
        _uow.Setup(u => u.RefreshTokens).Returns(_tokens.Object);
        _uow.Setup(u => u.SaveChangesAsync(default)).ReturnsAsync(1);
        _handler = new RevokeOtherSessionsCommandHandler(_uow.Object, _audit.Object);
    }

    [Fact]
    public async Task Handle_SingularMessageWhenExactlyOneRevoked()
    {
        _tokens.Setup(r => r.RevokeOtherSessionsAsync(_userId, It.IsAny<string?>(), default)).ReturnsAsync(1);

        var result = await _handler.Handle(new RevokeOtherSessionsCommand(_userId, "token"), default);

        Assert.Equal("1 other session signed out.", result.Message);
    }

    [Fact]
    public async Task Handle_PluralMessageForMultipleOrZero()
    {
        _tokens.Setup(r => r.RevokeOtherSessionsAsync(_userId, It.IsAny<string?>(), default)).ReturnsAsync(3);

        var result = await _handler.Handle(new RevokeOtherSessionsCommand(_userId, "token"), default);

        Assert.Equal("3 other sessions signed out.", result.Message);
        Assert.Equal(3, result.Data);
    }
}

public class GetAuditLogQueryHandlerTests
{
    private readonly Mock<IAuditLogRepository> _auditLog = new();
    private readonly GetAuditLogQueryHandler _handler;
    private readonly Guid _userId = Guid.NewGuid();

    public GetAuditLogQueryHandlerTests()
    {
        _handler = new GetAuditLogQueryHandler(_auditLog.Object);
    }

    [Fact]
    public async Task Handle_NegativePage_ClampsTo1()
    {
        _auditLog.Setup(r => r.GetForUserAsync(_userId, 1, 25, default)).ReturnsAsync((new List<AuditLogEntry>(), 0));

        await _handler.Handle(new GetAuditLogQuery(_userId, -5, 25), default);

        _auditLog.Verify(r => r.GetForUserAsync(_userId, 1, 25, default), Times.Once);
    }

    [Theory]
    [InlineData(0, 1)]
    [InlineData(500, 100)]
    public async Task Handle_ClampsPageSize(int requested, int expected)
    {
        _auditLog.Setup(r => r.GetForUserAsync(_userId, 1, expected, default)).ReturnsAsync((new List<AuditLogEntry>(), 0));

        await _handler.Handle(new GetAuditLogQuery(_userId, 1, requested), default);

        _auditLog.Verify(r => r.GetForUserAsync(_userId, 1, expected, default), Times.Once);
    }

    [Fact]
    public async Task Handle_MapsEntriesToDtos()
    {
        var entry = new AuditLogEntry { AuditLogEntryId = Guid.NewGuid(), Action = "auth.login.succeeded", ActorUserId = _userId, CreatedAt = DateTime.UtcNow };
        _auditLog.Setup(r => r.GetForUserAsync(_userId, 1, 25, default)).ReturnsAsync((new List<AuditLogEntry> { entry }, 1));

        var result = await _handler.Handle(new GetAuditLogQuery(_userId), default);

        Assert.True(result.IsSuccess);
        Assert.Equal("auth.login.succeeded", result.Data!.Items.Single().Action);
    }
}

public class TwoFactorChallengeTests
{
    private readonly Mock<IAppCache> _cache = new();
    private readonly Guid _userId = Guid.NewGuid();

    [Fact]
    public async Task IssueAsync_StoresUserIdKeyedByGeneratedToken()
    {
        string? capturedKey = null;
        string? capturedValue = null;
        _cache.Setup(c => c.SetAsync(It.IsAny<string>(), It.IsAny<string>(), TwoFactorChallenge.Lifetime, default))
            .Callback<string, string, TimeSpan, CancellationToken>((k, v, _, _) => { capturedKey = k; capturedValue = v; })
            .Returns(Task.CompletedTask);

        var token = await TwoFactorChallenge.IssueAsync(_cache.Object, _userId, default);

        Assert.NotEmpty(token);
        Assert.Contains(token, capturedKey);
        Assert.Equal(_userId.ToString(), capturedValue);
    }

    [Fact]
    public async Task ResolveAsync_BlankToken_ReturnsNullWithoutTouchingCache()
    {
        var result = await TwoFactorChallenge.ResolveAsync(_cache.Object, "", default);

        Assert.Null(result);
        _cache.Verify(c => c.GetAsync<string>(It.IsAny<string>(), default), Times.Never);
    }

    [Fact]
    public async Task ResolveAsync_ValidToken_ReturnsUserId()
    {
        _cache.Setup(c => c.GetAsync<string>($"2fa:challenge:tok-1", default)).ReturnsAsync(_userId.ToString());

        var result = await TwoFactorChallenge.ResolveAsync(_cache.Object, "tok-1", default);

        Assert.Equal(_userId, result);
    }

    [Fact]
    public async Task ResolveAsync_UnknownOrExpiredToken_ReturnsNull()
    {
        _cache.Setup(c => c.GetAsync<string>(It.IsAny<string>(), default)).ReturnsAsync((string?)null);

        var result = await TwoFactorChallenge.ResolveAsync(_cache.Object, "tok-1", default);

        Assert.Null(result);
    }

    [Fact]
    public async Task ConsumeAsync_RemovesTheChallengeKey()
    {
        _cache.Setup(c => c.RemoveAsync("2fa:challenge:tok-1", default)).Returns(Task.CompletedTask);

        await TwoFactorChallenge.ConsumeAsync(_cache.Object, "tok-1", default);

        _cache.Verify(c => c.RemoveAsync("2fa:challenge:tok-1", default), Times.Once);
    }
}
