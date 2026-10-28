using MediatR;
using StudyPlatform.Application.Auth.DTOs;
using StudyPlatform.Application.Common;
using StudyPlatform.Application.Services;
using StudyPlatform.Domain.Entities;
using StudyPlatform.Domain.Enums;
using StudyPlatform.Domain.Interfaces;

namespace StudyPlatform.Application.Auth.Commands;

public record RegisterCommand(
    string Email,
    string Password,
    string FullName,
    string OtpCode) : IRequest<Result<AuthResponse>>;

public class RegisterCommandHandler : IRequestHandler<RegisterCommand, Result<AuthResponse>>
{
    private readonly IUserRepository _users;
    private readonly IOtpRepository _otps;
    private readonly IEmailService _emailService;
    private readonly IPasswordHasher _passwordHasher;
    private readonly IAuthSessionIssuer _sessionIssuer;

    public RegisterCommandHandler(
        IUserRepository users,
        IOtpRepository otps,
        IEmailService emailService,
        IPasswordHasher passwordHasher,
        IAuthSessionIssuer sessionIssuer)
    {
        _users = users;
        _otps = otps;
        _emailService = emailService;
        _passwordHasher = passwordHasher;
        _sessionIssuer = sessionIssuer;
    }

    public async Task<Result<AuthResponse>> Handle(RegisterCommand request, CancellationToken cancellationToken)
    {
        var email = OtpVerifier.NormalizeEmail(request.Email);
        var emailExists = await _users.EmailExistsAsync(email, cancellationToken);
        if (emailExists)
            return Result<AuthResponse>.Failure("Email is already registered.", "EMAIL_ALREADY_EXISTS");

        var otp = await _otps.GetActiveOtpAsync(email, OtpPurpose.Registration, cancellationToken);
        if (!await OtpVerifier.TryConsumeAsync(_otps, otp, request.OtpCode, cancellationToken))
            return Result<AuthResponse>.Failure("Invalid or expired OTP code.", "INVALID_OTP");

        var user = new User
        {
            UserId = Guid.NewGuid(),
            Email = email,
            PasswordHash = _passwordHasher.Hash(request.Password),
            FullName = request.FullName,
            IsEmailVerified = true,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        await _users.AddAsync(user, cancellationToken);

        // Issuing the session is what saves the unit of work, so the new user lands in the same
        // transaction as the refresh-token row. The OTP was already spent by TryConsumeAsync.
        var response = await _sessionIssuer.IssueAsync(user, cancellationToken: cancellationToken);

        await _emailService.SendWelcomeEmailAsync(user.Email, user.FullName, cancellationToken);

        return Result<AuthResponse>.Success(response, "Registration successful.");
    }
}
