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
    private readonly ITokenService _tokenService;
    private readonly IEmailService _emailService;
    private readonly IPasswordHasher _passwordHasher;
    private readonly IRequestContext _requestContext;

    public RegisterCommandHandler(
        IUnitOfWork unitOfWork,
        ITokenService tokenService,
        IEmailService emailService,
        IPasswordHasher passwordHasher,
        IRequestContext requestContext)
    {
        _unitOfWork = unitOfWork;
        _tokenService = tokenService;
        _emailService = emailService;
        _passwordHasher = passwordHasher;
        _requestContext = requestContext;
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

        var accessToken = _tokenService.GenerateAccessToken(user);
        var refreshTokenValue = _tokenService.GenerateRefreshToken();
        var refreshToken = RefreshTokenFactory.Create(user.UserId, refreshTokenValue, _requestContext);

        await _unitOfWork.RefreshTokens.AddAsync(refreshToken, cancellationToken);
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        await _emailService.SendWelcomeEmailAsync(user.Email, user.FullName, cancellationToken);

        var response = new AuthResponse(
            user.UserId,
            user.Email,
            user.FullName,
            accessToken,
            refreshTokenValue,
            DateTime.UtcNow.AddMinutes(15));

        return Result<AuthResponse>.Success(response, "Registration successful.");
    }
}
