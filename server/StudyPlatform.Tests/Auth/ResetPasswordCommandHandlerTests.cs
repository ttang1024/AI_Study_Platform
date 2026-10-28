using Moq;
using StudyPlatform.Application.Auth.Commands;
using StudyPlatform.Application.Services;
using StudyPlatform.Domain.Entities;
using StudyPlatform.Domain.Enums;
using StudyPlatform.Domain.Interfaces;
using StudyPlatform.Tests.TestSupport;
using Xunit;

namespace StudyPlatform.Tests.Auth;

public class ResetPasswordCommandHandlerTests
{
    private readonly Mock<IUnitOfWork> _uow = new();
    private readonly Mock<IUserRepository> _users = new();
    private readonly Mock<IOtpRepository> _otps = new();
    private readonly Mock<IRefreshTokenRepository> _tokens = new();
    private readonly Mock<IPasswordHasher> _hasher = new();
    private readonly ResetPasswordCommandHandler _handler;

    public ResetPasswordCommandHandlerTests()
    {
        _uow.Setup(u => u.SaveChangesAsync(default)).ReturnsAsync(1);
        _handler = new ResetPasswordCommandHandler(_uow.Object, _users.Object, _otps.Object, _tokens.Object, _hasher.Object);
    }

    private User MakeUser() => new()
    {
        UserId = Guid.NewGuid(),
        Email = "user@example.com",
        PasswordHash = "old-hash"
    };

    private OtpCode MakeOtp(string email) => new()
    {
        OtpId = Guid.NewGuid(),
        Email = email,
        Code = "123456",
        Purpose = OtpPurpose.PasswordReset,
        IsUsed = false,
        ExpiresAt = DateTime.UtcNow.AddMinutes(10)
    };

    [Fact]
    public async Task Handle_ValidRequest_ResetsPasswordAndRevokesTokens()
    {
        var user = MakeUser();
        var otp = MakeOtp("user@example.com");
        _users.Setup(r => r.GetByEmailAsync("user@example.com", default)).ReturnsAsync(user);
        _otps.Setup(r => r.GetActiveOtpAsync("user@example.com", OtpPurpose.PasswordReset, default)).ReturnsAsync(otp);
        _otps.WithAtomicOps(otp);
        _hasher.Setup(h => h.Hash("NewPass1")).Returns("new-hash");
        _tokens.Setup(r => r.RevokeAllUserTokensAsync(user.UserId, default)).Returns(Task.CompletedTask);

        var result = await _handler.Handle(new ResetPasswordCommand("user@example.com", "123456", "NewPass1"), default);

        Assert.True(result.IsSuccess);
        Assert.Equal("new-hash", user.PasswordHash);
        Assert.True(otp.IsUsed);
        _tokens.Verify(r => r.RevokeAllUserTokensAsync(user.UserId, default), Times.Once);
        _uow.Verify(u => u.SaveChangesAsync(default), Times.Once);
    }

    [Fact]
    public async Task Handle_UserNotFound_FailsLikeAWrongCode()
    {
        _users.Setup(r => r.GetByEmailAsync(It.IsAny<string>(), default)).ReturnsAsync((User?)null);

        var result = await _handler.Handle(new ResetPasswordCommand("nobody@example.com", "123456", "NewPass1"), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("INVALID_OTP", result.ErrorCode);
        _uow.Verify(u => u.SaveChangesAsync(default), Times.Never);
    }

    [Fact]
    public async Task Handle_InvalidOtp_ReturnsFailure()
    {
        var user = MakeUser();
        _users.Setup(r => r.GetByEmailAsync("user@example.com", default)).ReturnsAsync(user);
        _otps.Setup(r => r.GetActiveOtpAsync(It.IsAny<string>(), It.IsAny<OtpPurpose>(), default))
            .ReturnsAsync((OtpCode?)null);

        var result = await _handler.Handle(new ResetPasswordCommand("user@example.com", "wrong-otp", "NewPass1"), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("INVALID_OTP", result.ErrorCode);
        _uow.Verify(u => u.SaveChangesAsync(default), Times.Never);
    }

    [Fact]
    public async Task Handle_EmailLookupIsCaseInsensitive()
    {
        var user = MakeUser();
        _users.Setup(r => r.GetByEmailAsync("user@example.com", default)).ReturnsAsync(user);
        _otps.Setup(r => r.GetActiveOtpAsync(It.IsAny<string>(), It.IsAny<OtpPurpose>(), default))
            .ReturnsAsync((OtpCode?)null);

        await _handler.Handle(new ResetPasswordCommand("USER@EXAMPLE.COM", "123456", "NewPass1"), default);

        _users.Verify(r => r.GetByEmailAsync("user@example.com", default), Times.Once);
    }

    [Fact]
    public async Task Handle_WrongCode_IsCounted_WithoutResettingThePassword()
    {
        var user = MakeUser();
        var otp = MakeOtp("user@example.com");
        _users.Setup(r => r.GetByEmailAsync("user@example.com", default)).ReturnsAsync(user);
        _otps.Setup(r => r.GetActiveOtpAsync("user@example.com", OtpPurpose.PasswordReset, default)).ReturnsAsync(otp);
        _otps.WithAtomicOps(otp);

        var result = await _handler.Handle(new ResetPasswordCommand("user@example.com", "999999", "NewPass1"), default);

        Assert.False(result.IsSuccess);
        Assert.Equal(1, otp.FailedAttempts);
        // Counted by the repository's own atomic UPDATE; saving the loaded row would write stale counters.
        _uow.Verify(u => u.SaveChangesAsync(default), Times.Never);
        _hasher.Verify(h => h.Hash(It.IsAny<string>()), Times.Never);
    }
}
