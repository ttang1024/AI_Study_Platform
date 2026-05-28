using Moq;
using StudyPlatform.Application.Auth.Commands;
using StudyPlatform.Application.Services;
using StudyPlatform.Domain.Entities;
using StudyPlatform.Domain.Enums;
using StudyPlatform.Domain.Interfaces;
using Xunit;

namespace StudyPlatform.Tests.Auth;

// ─── SendEmailOtpCommand ───────────────────────────────────────────────────────

public class SendEmailOtpCommandHandlerTests
{
    private readonly Mock<IUnitOfWork> _uow = new();
    private readonly Mock<IUserRepository> _users = new();
    private readonly Mock<IOtpRepository> _otps = new();
    private readonly Mock<IEmailService> _email = new();
    private readonly SendEmailOtpCommandHandler _handler;

    public SendEmailOtpCommandHandlerTests()
    {
        _uow.Setup(u => u.Users).Returns(_users.Object);
        _uow.Setup(u => u.Otps).Returns(_otps.Object);
        _uow.Setup(u => u.SaveChangesAsync(default)).ReturnsAsync(1);
        _otps.Setup(r => r.InvalidateExistingOtpsAsync(It.IsAny<string>(), It.IsAny<OtpPurpose>(), default))
            .Returns(Task.CompletedTask);
        _otps.Setup(r => r.AddAsync(It.IsAny<OtpCode>(), default)).Returns(Task.CompletedTask);
        _handler = new SendEmailOtpCommandHandler(_uow.Object, _email.Object);
    }

    private User MakeUser(string email = "user@example.com") => new()
    {
        UserId = Guid.NewGuid(),
        Email = email,
        FullName = "Test User",
        PasswordHash = "hash",
    };

    [Fact]
    public async Task Handle_RegistrationPurpose_NewEmail_SendsOtpAndReturnsSuccess()
    {
        _users.Setup(r => r.EmailExistsAsync("new@example.com", default)).ReturnsAsync(false);
        _email.Setup(e => e.SendOtpEmailAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(), default))
            .Returns(Task.CompletedTask);

        var result = await _handler.Handle(new SendEmailOtpCommand("new@example.com", "registration"), default);

        Assert.True(result.IsSuccess);
        _otps.Verify(r => r.AddAsync(It.IsAny<OtpCode>(), default), Times.Once);
        _email.Verify(e => e.SendOtpEmailAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(), default), Times.Once);
    }

    [Fact]
    public async Task Handle_RegistrationPurpose_ExistingEmail_ReturnsFailure()
    {
        _users.Setup(r => r.EmailExistsAsync("existing@example.com", default)).ReturnsAsync(true);

        var result = await _handler.Handle(new SendEmailOtpCommand("existing@example.com", "registration"), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("EMAIL_ALREADY_EXISTS", result.ErrorCode);
        _otps.Verify(r => r.AddAsync(It.IsAny<OtpCode>(), default), Times.Never);
    }

    [Fact]
    public async Task Handle_PasswordResetPurpose_ExistingUser_SendsOtp()
    {
        var user = MakeUser("user@example.com");
        _users.Setup(r => r.GetByEmailAsync("user@example.com", default)).ReturnsAsync(user);
        _email.Setup(e => e.SendOtpEmailAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(), default))
            .Returns(Task.CompletedTask);

        var result = await _handler.Handle(new SendEmailOtpCommand("user@example.com", "password_reset"), default);

        Assert.True(result.IsSuccess);
        _otps.Verify(r => r.AddAsync(It.Is<OtpCode>(o => o.UserId == user.UserId), default), Times.Once);
    }

    [Fact]
    public async Task Handle_PasswordResetPurpose_UnknownEmail_ReturnsFailure()
    {
        _users.Setup(r => r.GetByEmailAsync("unknown@example.com", default)).ReturnsAsync((User?)null);

        var result = await _handler.Handle(new SendEmailOtpCommand("unknown@example.com", "password_reset"), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("USER_NOT_FOUND", result.ErrorCode);
    }

    [Fact]
    public async Task Handle_EmailServiceFails_ReturnsFailure()
    {
        _users.Setup(r => r.EmailExistsAsync("new@example.com", default)).ReturnsAsync(false);
        _email.Setup(e => e.SendOtpEmailAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(), default))
            .ThrowsAsync(new Exception("SMTP error"));

        var result = await _handler.Handle(new SendEmailOtpCommand("new@example.com", "registration"), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("EMAIL_SEND_FAILED", result.ErrorCode);
    }

    [Fact]
    public async Task Handle_InvalidatesExistingOtpsBeforeCreatingNew()
    {
        _users.Setup(r => r.EmailExistsAsync("new@example.com", default)).ReturnsAsync(false);
        _email.Setup(e => e.SendOtpEmailAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(), default))
            .Returns(Task.CompletedTask);

        await _handler.Handle(new SendEmailOtpCommand("new@example.com", "registration"), default);

        _otps.Verify(r => r.InvalidateExistingOtpsAsync("new@example.com", OtpPurpose.Registration, default), Times.Once);
    }
}

// ─── UpdateProfileCommand ──────────────────────────────────────────────────────

public class UpdateProfileCommandHandlerTests
{
    private readonly Mock<IUnitOfWork> _uow = new();
    private readonly Mock<IUserRepository> _users = new();
    private readonly UpdateProfileCommandHandler _handler;

    public UpdateProfileCommandHandlerTests()
    {
        _uow.Setup(u => u.Users).Returns(_users.Object);
        _uow.Setup(u => u.SaveChangesAsync(default)).ReturnsAsync(1);
        _handler = new UpdateProfileCommandHandler(_uow.Object);
    }

    private User MakeUser() => new()
    {
        UserId = Guid.NewGuid(),
        Email = "user@example.com",
        FullName = "Old Name",
        PasswordHash = "hash",
    };

    [Fact]
    public async Task Handle_ExistingUser_UpdatesFullNameAndReturnsSuccess()
    {
        var user = MakeUser();
        _users.Setup(r => r.GetByIdAsync(user.UserId, default)).ReturnsAsync(user);

        var result = await _handler.Handle(new UpdateProfileCommand(user.UserId, "New Name"), default);

        Assert.True(result.IsSuccess);
        Assert.Equal("New Name", user.FullName);
        _users.Verify(r => r.Update(user), Times.Once);
        _uow.Verify(u => u.SaveChangesAsync(default), Times.Once);
    }

    [Fact]
    public async Task Handle_UserNotFound_ReturnsFailure()
    {
        _users.Setup(r => r.GetByIdAsync(It.IsAny<Guid>(), default)).ReturnsAsync((User?)null);

        var result = await _handler.Handle(new UpdateProfileCommand(Guid.NewGuid(), "Name"), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("USER_NOT_FOUND", result.ErrorCode);
    }
}
