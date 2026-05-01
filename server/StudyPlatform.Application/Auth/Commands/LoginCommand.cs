using MediatR;
using StudyPlatform.Application.Auth.DTOs;
using StudyPlatform.Application.Common;
using StudyPlatform.Application.Services;
using StudyPlatform.Domain.Entities;
using StudyPlatform.Domain.Interfaces;

namespace StudyPlatform.Application.Auth.Commands;

public record LoginCommand(string Email, string Password) : IRequest<Result<AuthResponse>>;

public class LoginCommandHandler : IRequestHandler<LoginCommand, Result<AuthResponse>>
{
    private readonly IUnitOfWork _unitOfWork;
    private readonly ITokenService _tokenService;
    private readonly IPasswordHasher _passwordHasher;

    public LoginCommandHandler(IUnitOfWork unitOfWork, ITokenService tokenService, IPasswordHasher passwordHasher)
    {
        _unitOfWork = unitOfWork;
        _tokenService = tokenService;
        _passwordHasher = passwordHasher;
    }

    public async Task<Result<AuthResponse>> Handle(LoginCommand request, CancellationToken cancellationToken)
    {
        var user = await _unitOfWork.Users.GetByEmailAsync(request.Email.ToLowerInvariant(), cancellationToken);
        if (user == null)
            return Result<AuthResponse>.Failure("Invalid email or password.", "INVALID_CREDENTIALS");

        if (!_passwordHasher.Verify(request.Password, user.PasswordHash))
            return Result<AuthResponse>.Failure("Invalid email or password.", "INVALID_CREDENTIALS");

        if (!user.IsEmailVerified)
            return Result<AuthResponse>.Failure("Email not verified.", "EMAIL_NOT_VERIFIED");

        if (!user.IsActive)
            return Result<AuthResponse>.Failure("Your account has been deactivated. Please contact support.", "ACCOUNT_DEACTIVATED");

        var accessToken = _tokenService.GenerateAccessToken(user);
        var refreshTokenValue = _tokenService.GenerateRefreshToken();
        var refreshToken = new RefreshToken
        {
            TokenId = Guid.NewGuid(),
            UserId = user.UserId,
            Token = refreshTokenValue,
            ExpiresAt = DateTime.UtcNow.AddDays(7),
            IsRevoked = false,
            CreatedAt = DateTime.UtcNow
        };

        await _unitOfWork.RefreshTokens.AddAsync(refreshToken, cancellationToken);
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        var response = new AuthResponse(
            user.UserId,
            user.Email,
            user.FullName,
            accessToken,
            refreshTokenValue,
            DateTime.UtcNow.AddMinutes(15));

        return Result<AuthResponse>.Success(response, "Login successful.");
    }
}
