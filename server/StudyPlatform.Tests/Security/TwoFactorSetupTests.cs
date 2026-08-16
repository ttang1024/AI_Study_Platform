using Moq;
using StudyPlatform.Application.Security.Commands;
using StudyPlatform.Application.Services;
using StudyPlatform.Domain.Entities;
using StudyPlatform.Domain.Interfaces;
using Xunit;

namespace StudyPlatform.Tests.Security;

public class StartTwoFactorSetupCommandHandlerTests
{
    private readonly Mock<IUnitOfWork> _uow = new();
    private readonly Mock<IUserRepository> _users = new();
    private readonly Mock<IUserTwoFactorRepository> _factors = new();
    private readonly Mock<ITotpService> _totp = new();
    private readonly StartTwoFactorSetupCommandHandler _handler;
    private readonly Guid _userId = Guid.NewGuid();

    public StartTwoFactorSetupCommandHandlerTests()
    {
        _uow.Setup(u => u.Users).Returns(_users.Object);
        _uow.Setup(u => u.UserTwoFactors).Returns(_factors.Object);
        _uow.Setup(u => u.SaveChangesAsync(default)).ReturnsAsync(1);
        _users.Setup(r => r.GetByIdAsync(_userId, default)).ReturnsAsync(new User { UserId = _userId, Email = "a@b.com" });
        _totp.Setup(t => t.GenerateSecret()).Returns("SECRET123");
        _totp.Setup(t => t.BuildProvisioningUri("SECRET123", "StudyPlatform", "a@b.com")).Returns("otpauth://totp/...");
        _factors.Setup(r => r.AddAsync(It.IsAny<UserTwoFactor>(), default)).Returns(Task.CompletedTask);
        _handler = new StartTwoFactorSetupCommandHandler(_uow.Object, _totp.Object);
    }

    [Fact]
    public async Task Handle_UserNotFound_ReturnsFailure()
    {
        _users.Setup(r => r.GetByIdAsync(_userId, default)).ReturnsAsync((User?)null);

        var result = await _handler.Handle(new StartTwoFactorSetupCommand(_userId), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("USER_NOT_FOUND", result.ErrorCode);
    }

    [Fact]
    public async Task Handle_AlreadyEnabled_ReturnsFailure()
    {
        _factors.Setup(r => r.GetByUserIdAsync(_userId, default))
            .ReturnsAsync(new UserTwoFactor { UserId = _userId, IsEnabled = true });

        var result = await _handler.Handle(new StartTwoFactorSetupCommand(_userId), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("TWO_FACTOR_ALREADY_ENABLED", result.ErrorCode);
    }

    [Fact]
    public async Task Handle_NoExistingFactor_CreatesNewPendingRow()
    {
        _factors.Setup(r => r.GetByUserIdAsync(_userId, default)).ReturnsAsync((UserTwoFactor?)null);

        var result = await _handler.Handle(new StartTwoFactorSetupCommand(_userId), default);

        Assert.True(result.IsSuccess);
        Assert.Equal("SECRET123", result.Data!.Secret);
        _factors.Verify(r => r.AddAsync(It.Is<UserTwoFactor>(f => !f.IsEnabled && f.SecretBase32 == "SECRET123"), default), Times.Once);
    }

    [Fact]
    public async Task Handle_AbandonedPendingEnrolment_OverwritesSecret()
    {
        var existing = new UserTwoFactor { UserId = _userId, IsEnabled = false, SecretBase32 = "OLD", LastUsedStep = 5 };
        _factors.Setup(r => r.GetByUserIdAsync(_userId, default)).ReturnsAsync(existing);

        var result = await _handler.Handle(new StartTwoFactorSetupCommand(_userId), default);

        Assert.True(result.IsSuccess);
        Assert.Equal("SECRET123", existing.SecretBase32);
        Assert.Equal(0, existing.LastUsedStep);
        _factors.Verify(r => r.AddAsync(It.IsAny<UserTwoFactor>(), default), Times.Never);
        _factors.Verify(r => r.Update(existing), Times.Once);
    }
}

public class ConfirmTwoFactorSetupCommandHandlerTests
{
    private readonly Mock<IUnitOfWork> _uow = new();
    private readonly Mock<IUserTwoFactorRepository> _factors = new();
    private readonly Mock<ITotpService> _totp = new();
    private readonly Mock<IPasswordHasher> _hasher = new();
    private readonly Mock<IAuditLogger> _audit = new();
    private readonly ConfirmTwoFactorSetupCommandHandler _handler;
    private readonly Guid _userId = Guid.NewGuid();

    public ConfirmTwoFactorSetupCommandHandlerTests()
    {
        _uow.Setup(u => u.UserTwoFactors).Returns(_factors.Object);
        _uow.Setup(u => u.SaveChangesAsync(default)).ReturnsAsync(1);
        _hasher.Setup(h => h.Hash(It.IsAny<string>())).Returns("hashed");
        _handler = new ConfirmTwoFactorSetupCommandHandler(_uow.Object, _totp.Object, _hasher.Object, _audit.Object);
    }

    [Fact]
    public async Task Handle_SetupNotStarted_ReturnsFailure()
    {
        _factors.Setup(r => r.GetByUserIdAsync(_userId, default)).ReturnsAsync((UserTwoFactor?)null);

        var result = await _handler.Handle(new ConfirmTwoFactorSetupCommand(_userId, "123456"), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("TWO_FACTOR_SETUP_NOT_STARTED", result.ErrorCode);
    }

    [Fact]
    public async Task Handle_AlreadyEnabled_ReturnsFailure()
    {
        _factors.Setup(r => r.GetByUserIdAsync(_userId, default)).ReturnsAsync(new UserTwoFactor { UserId = _userId, IsEnabled = true });

        var result = await _handler.Handle(new ConfirmTwoFactorSetupCommand(_userId, "123456"), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("TWO_FACTOR_ALREADY_ENABLED", result.ErrorCode);
    }

    [Fact]
    public async Task Handle_InvalidCode_LogsFailureAndReturnsError()
    {
        var factor = new UserTwoFactor { UserId = _userId, IsEnabled = false, SecretBase32 = "SECRET" };
        _factors.Setup(r => r.GetByUserIdAsync(_userId, default)).ReturnsAsync(factor);
        _totp.Setup(t => t.Verify("SECRET", "000000", 0)).Returns((long?)null);

        var result = await _handler.Handle(new ConfirmTwoFactorSetupCommand(_userId, "000000"), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("INVALID_TOTP_CODE", result.ErrorCode);
        _audit.Verify(a => a.LogAsync(Application.Services.AuditActions.TwoFactorChallengeFailed, _userId, null, null, null, It.IsAny<object?>(), default), Times.Once);
    }

    [Fact]
    public async Task Handle_ValidCode_EnablesFactorAndReturnsRecoveryCodes()
    {
        var factor = new UserTwoFactor { UserId = _userId, IsEnabled = false, SecretBase32 = "SECRET", LastUsedStep = 0 };
        _factors.Setup(r => r.GetByUserIdAsync(_userId, default)).ReturnsAsync(factor);
        _totp.Setup(t => t.Verify("SECRET", "123456", 0)).Returns(42L);

        var result = await _handler.Handle(new ConfirmTwoFactorSetupCommand(_userId, "123456"), default);

        Assert.True(result.IsSuccess);
        Assert.True(factor.IsEnabled);
        Assert.Equal(42, factor.LastUsedStep);
        Assert.NotNull(factor.EnabledAt);
        Assert.Equal(10, result.Data!.RecoveryCodes.Count);
        _audit.Verify(a => a.LogAsync(Application.Services.AuditActions.TwoFactorEnabled, _userId, null, null, null, null, default), Times.Once);
    }
}

public class DisableTwoFactorCommandHandlerTests
{
    private readonly Mock<IUnitOfWork> _uow = new();
    private readonly Mock<IUserRepository> _users = new();
    private readonly Mock<IUserTwoFactorRepository> _factors = new();
    private readonly Mock<IPasswordHasher> _hasher = new();
    private readonly Mock<IAuditLogger> _audit = new();
    private readonly DisableTwoFactorCommandHandler _handler;
    private readonly Guid _userId = Guid.NewGuid();

    public DisableTwoFactorCommandHandlerTests()
    {
        _uow.Setup(u => u.Users).Returns(_users.Object);
        _uow.Setup(u => u.UserTwoFactors).Returns(_factors.Object);
        _uow.Setup(u => u.SaveChangesAsync(default)).ReturnsAsync(1);
        _users.Setup(r => r.GetByIdAsync(_userId, default)).ReturnsAsync(new User { UserId = _userId, PasswordHash = "hash" });
        _handler = new DisableTwoFactorCommandHandler(_uow.Object, _hasher.Object, _audit.Object);
    }

    [Fact]
    public async Task Handle_UserNotFound_ReturnsFailure()
    {
        _users.Setup(r => r.GetByIdAsync(_userId, default)).ReturnsAsync((User?)null);

        var result = await _handler.Handle(new DisableTwoFactorCommand(_userId, "pw"), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("USER_NOT_FOUND", result.ErrorCode);
    }

    [Fact]
    public async Task Handle_WrongPassword_ReturnsFailure()
    {
        _hasher.Setup(h => h.Verify("wrong", "hash")).Returns(false);

        var result = await _handler.Handle(new DisableTwoFactorCommand(_userId, "wrong"), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("INVALID_PASSWORD", result.ErrorCode);
    }

    [Fact]
    public async Task Handle_NotEnabled_ReturnsFailure()
    {
        _hasher.Setup(h => h.Verify("pw", "hash")).Returns(true);
        _factors.Setup(r => r.GetByUserIdAsync(_userId, default)).ReturnsAsync((UserTwoFactor?)null);

        var result = await _handler.Handle(new DisableTwoFactorCommand(_userId, "pw"), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("TWO_FACTOR_NOT_ENABLED", result.ErrorCode);
    }

    [Fact]
    public async Task Handle_ValidRequest_RemovesFactorAndAudits()
    {
        _hasher.Setup(h => h.Verify("pw", "hash")).Returns(true);
        var factor = new UserTwoFactor { UserId = _userId, IsEnabled = true };
        _factors.Setup(r => r.GetByUserIdAsync(_userId, default)).ReturnsAsync(factor);

        var result = await _handler.Handle(new DisableTwoFactorCommand(_userId, "pw"), default);

        Assert.True(result.IsSuccess);
        _factors.Verify(r => r.Remove(factor), Times.Once);
        _audit.Verify(a => a.LogAsync(Application.Services.AuditActions.TwoFactorDisabled, _userId, null, null, null, null, default), Times.Once);
    }
}

public class RegenerateRecoveryCodesCommandHandlerTests
{
    private readonly Mock<IUnitOfWork> _uow = new();
    private readonly Mock<IUserRepository> _users = new();
    private readonly Mock<IUserTwoFactorRepository> _factors = new();
    private readonly Mock<IPasswordHasher> _hasher = new();
    private readonly Mock<IAuditLogger> _audit = new();
    private readonly RegenerateRecoveryCodesCommandHandler _handler;
    private readonly Guid _userId = Guid.NewGuid();

    public RegenerateRecoveryCodesCommandHandlerTests()
    {
        _uow.Setup(u => u.Users).Returns(_users.Object);
        _uow.Setup(u => u.UserTwoFactors).Returns(_factors.Object);
        _uow.Setup(u => u.SaveChangesAsync(default)).ReturnsAsync(1);
        _users.Setup(r => r.GetByIdAsync(_userId, default)).ReturnsAsync(new User { UserId = _userId, PasswordHash = "hash" });
        _hasher.Setup(h => h.Hash(It.IsAny<string>())).Returns("hashed");
        _handler = new RegenerateRecoveryCodesCommandHandler(_uow.Object, _hasher.Object, _audit.Object);
    }

    [Fact]
    public async Task Handle_WrongPassword_ReturnsFailure()
    {
        _hasher.Setup(h => h.Verify("wrong", "hash")).Returns(false);

        var result = await _handler.Handle(new RegenerateRecoveryCodesCommand(_userId, "wrong"), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("INVALID_PASSWORD", result.ErrorCode);
    }

    [Fact]
    public async Task Handle_NotEnabled_ReturnsFailure()
    {
        _hasher.Setup(h => h.Verify("pw", "hash")).Returns(true);
        _factors.Setup(r => r.GetByUserIdAsync(_userId, default)).ReturnsAsync((UserTwoFactor?)null);

        var result = await _handler.Handle(new RegenerateRecoveryCodesCommand(_userId, "pw"), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("TWO_FACTOR_NOT_ENABLED", result.ErrorCode);
    }

    [Fact]
    public async Task Handle_ValidRequest_ReplacesRecoveryCodeHashes()
    {
        _hasher.Setup(h => h.Verify("pw", "hash")).Returns(true);
        var factor = new UserTwoFactor { UserId = _userId, IsEnabled = true, RecoveryCodeHashesJson = "[\"old\"]" };
        _factors.Setup(r => r.GetByUserIdAsync(_userId, default)).ReturnsAsync(factor);

        var result = await _handler.Handle(new RegenerateRecoveryCodesCommand(_userId, "pw"), default);

        Assert.True(result.IsSuccess);
        Assert.Equal(10, result.Data!.RecoveryCodes.Count);
        Assert.DoesNotContain("old", factor.RecoveryCodeHashesJson);
        _audit.Verify(a => a.LogAsync(Application.Services.AuditActions.RecoveryCodesRegenerated, _userId, null, null, null, null, default), Times.Once);
    }
}
