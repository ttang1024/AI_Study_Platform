using Moq;
using StudyPlatform.Application.Auth.Commands;
using StudyPlatform.Application.Services;
using StudyPlatform.Domain.Entities;
using StudyPlatform.Domain.Enums;
using StudyPlatform.Domain.Interfaces;
using Xunit;

namespace StudyPlatform.Tests.Auth;

public class RegisterCommandHandlerTests
{
    private readonly Mock<IUnitOfWork> _uow = new();
    private readonly Mock<IUserRepository> _users = new();
    private readonly Mock<IOtpRepository> _otps = new();
    private readonly Mock<IRefreshTokenRepository> _tokens = new();
    private readonly Mock<ITokenService> _tokenService = new();
    private readonly Mock<IRequestContext> _requestContext = new();
    private readonly Mock<IEmailService> _emailService = new();
    private readonly Mock<IPasswordHasher> _hasher = new();
    private readonly RegisterCommandHandler _handler;

    public RegisterCommandHandlerTests()
    {
        _uow.Setup(u => u.Users).Returns(_users.Object);
        _uow.Setup(u => u.Otps).Returns(_otps.Object);
        _uow.Setup(u => u.RefreshTokens).Returns(_tokens.Object);
        _uow.Setup(u => u.SaveChangesAsync(default)).ReturnsAsync(1);
        _handler = new RegisterCommandHandler(_uow.Object, _tokenService.Object, _emailService.Object, _hasher.Object, _requestContext.Object);
    }

    private static RegisterCommand Valid() => new("user@example.com", "Password1", "Test User", "123456");

    private void SetupValidOtp()
    {
        var otp = new OtpCode { OtpId = Guid.NewGuid(), Email = "user@example.com", Code = "123456", Purpose = OtpPurpose.Registration };
        _otps.Setup(r => r.GetValidOtpAsync("user@example.com", "123456", OtpPurpose.Registration, default)).ReturnsAsync(otp);
    }

    [Fact]
    public async Task Handle_ValidCommand_ReturnsSuccess()
    {
        _users.Setup(r => r.EmailExistsAsync("user@example.com", default)).ReturnsAsync(false);
        SetupValidOtp();
        _hasher.Setup(h => h.Hash("Password1")).Returns("hashed");
        _tokenService.Setup(t => t.GenerateAccessToken(It.IsAny<User>())).Returns("access-token");
        _tokenService.Setup(t => t.GenerateRefreshToken()).Returns("refresh-token");
        _tokens.Setup(r => r.AddAsync(It.IsAny<RefreshToken>(), default)).Returns(Task.CompletedTask);
        _users.Setup(r => r.AddAsync(It.IsAny<User>(), default)).Returns(Task.CompletedTask);
        _emailService.Setup(e => e.SendWelcomeEmailAsync(It.IsAny<string>(), It.IsAny<string>(), default)).Returns(Task.CompletedTask);

        var result = await _handler.Handle(Valid(), default);

        Assert.True(result.IsSuccess);
        Assert.Equal("access-token", result.Data!.AccessToken);
        Assert.Equal("refresh-token", result.Data.RefreshToken);
    }

    [Fact]
    public async Task Handle_EmailAlreadyExists_ReturnsFailure()
    {
        _users.Setup(r => r.EmailExistsAsync("user@example.com", default)).ReturnsAsync(true);

        var result = await _handler.Handle(Valid(), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("EMAIL_ALREADY_EXISTS", result.ErrorCode);
        _users.Verify(r => r.AddAsync(It.IsAny<User>(), default), Times.Never);
    }

    [Fact]
    public async Task Handle_InvalidOtp_ReturnsFailure()
    {
        _users.Setup(r => r.EmailExistsAsync("user@example.com", default)).ReturnsAsync(false);
        _otps.Setup(r => r.GetValidOtpAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<OtpPurpose>(), default))
            .ReturnsAsync((OtpCode?)null);

        var result = await _handler.Handle(Valid(), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("INVALID_OTP", result.ErrorCode);
        _users.Verify(r => r.AddAsync(It.IsAny<User>(), default), Times.Never);
    }

    [Fact]
    public async Task Handle_EmailStoredAsLowercase()
    {
        _users.Setup(r => r.EmailExistsAsync(It.IsAny<string>(), default)).ReturnsAsync(false);
        var otp = new OtpCode { OtpId = Guid.NewGuid(), Email = "USER@EXAMPLE.COM", Code = "123456", Purpose = OtpPurpose.Registration };
        _otps.Setup(r => r.GetValidOtpAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<OtpPurpose>(), default)).ReturnsAsync(otp);
        _hasher.Setup(h => h.Hash(It.IsAny<string>())).Returns("hashed");
        _tokenService.Setup(t => t.GenerateAccessToken(It.IsAny<User>())).Returns("tok");
        _tokenService.Setup(t => t.GenerateRefreshToken()).Returns("ref");
        _tokens.Setup(r => r.AddAsync(It.IsAny<RefreshToken>(), default)).Returns(Task.CompletedTask);
        _emailService.Setup(e => e.SendWelcomeEmailAsync(It.IsAny<string>(), It.IsAny<string>(), default)).Returns(Task.CompletedTask);

        User? captured = null;
        _users.Setup(r => r.AddAsync(It.IsAny<User>(), default))
            .Callback<User, CancellationToken>((u, _) => captured = u)
            .Returns(Task.CompletedTask);

        await _handler.Handle(new RegisterCommand("USER@EXAMPLE.COM", "Password1", "Test User", "123456"), default);

        Assert.Equal("user@example.com", captured?.Email);
    }

    [Fact]
    public async Task Handle_OtpMarkedAsUsed()
    {
        _users.Setup(r => r.EmailExistsAsync("user@example.com", default)).ReturnsAsync(false);
        var otp = new OtpCode { OtpId = Guid.NewGuid(), Email = "user@example.com", Code = "123456", Purpose = OtpPurpose.Registration, IsUsed = false };
        _otps.Setup(r => r.GetValidOtpAsync("user@example.com", "123456", OtpPurpose.Registration, default)).ReturnsAsync(otp);
        _hasher.Setup(h => h.Hash(It.IsAny<string>())).Returns("hashed");
        _tokenService.Setup(t => t.GenerateAccessToken(It.IsAny<User>())).Returns("tok");
        _tokenService.Setup(t => t.GenerateRefreshToken()).Returns("ref");
        _tokens.Setup(r => r.AddAsync(It.IsAny<RefreshToken>(), default)).Returns(Task.CompletedTask);
        _users.Setup(r => r.AddAsync(It.IsAny<User>(), default)).Returns(Task.CompletedTask);
        _emailService.Setup(e => e.SendWelcomeEmailAsync(It.IsAny<string>(), It.IsAny<string>(), default)).Returns(Task.CompletedTask);

        await _handler.Handle(Valid(), default);

        Assert.True(otp.IsUsed);
    }
}
