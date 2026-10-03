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
    private readonly IUnitOfWork _unitOfWork;
    private readonly IEmailService _emailService;
    private readonly IPasswordHasher _passwordHasher;
    private readonly IAuthSessionIssuer _sessionIssuer;

    public RegisterCommandHandler(
        IUnitOfWork unitOfWork,
        IEmailService emailService,
        IPasswordHasher passwordHasher,
        IAuthSessionIssuer sessionIssuer)
    {
        _unitOfWork = unitOfWork;
        _emailService = emailService;
        _passwordHasher = passwordHasher;
        _sessionIssuer = sessionIssuer;
    }

    public async Task<Result<AuthResponse>> Handle(RegisterCommand request, CancellationToken cancellationToken)
    {
        var emailExists = await _unitOfWork.Users.EmailExistsAsync(request.Email, cancellationToken);
        if (emailExists)
            return Result<AuthResponse>.Failure("Email is already registered.", "EMAIL_ALREADY_EXISTS");

        var otp = await _unitOfWork.Otps.GetValidOtpAsync(request.Email, request.OtpCode, OtpPurpose.Registration, cancellationToken);
        if (otp == null)
            return Result<AuthResponse>.Failure("Invalid or expired OTP code.", "INVALID_OTP");

        var user = new User
        {
            UserId = Guid.NewGuid(),
            Email = request.Email.ToLowerInvariant(),
            PasswordHash = _passwordHasher.Hash(request.Password),
            FullName = request.FullName,
            IsEmailVerified = true,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        otp.IsUsed = true;

        await _unitOfWork.Users.AddAsync(user, cancellationToken);
        _unitOfWork.Otps.Update(otp);

        // Issuing the session is what saves the unit of work, so the new user and the spent OTP
        // land in the same transaction as the refresh-token row.
        var response = await _sessionIssuer.IssueAsync(user, cancellationToken: cancellationToken);

        await _emailService.SendWelcomeEmailAsync(user.Email, user.FullName, cancellationToken);

        return Result<AuthResponse>.Success(response, "Registration successful.");
    }
}
