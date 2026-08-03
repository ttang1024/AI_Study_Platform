using MediatR;
using StudyPlatform.Application.Auth.DTOs;
using StudyPlatform.Application.Common;
using StudyPlatform.Application.Security;
using StudyPlatform.Application.Services;
using StudyPlatform.Domain.Interfaces;

namespace StudyPlatform.Application.Auth.Commands;

public record LoginCommand(string Email, string Password) : IRequest<Result<AuthResponse>>;

public class LoginCommandHandler : IRequestHandler<LoginCommand, Result<AuthResponse>>
{
    private readonly IUnitOfWork _unitOfWork;
    private readonly ITokenService _tokenService;
    private readonly IPasswordHasher _passwordHasher;
    private readonly IAppCache _cache;
    private readonly IRequestContext _requestContext;
    private readonly IAuditLogger _audit;

    public LoginCommandHandler(
        IUnitOfWork unitOfWork,
        ITokenService tokenService,
        IPasswordHasher passwordHasher,
        IAppCache cache,
        IRequestContext requestContext,
        IAuditLogger audit)
    {
        _unitOfWork = unitOfWork;
        _tokenService = tokenService;
        _passwordHasher = passwordHasher;
        _cache = cache;
        _requestContext = requestContext;
        _audit = audit;
    }

    public async Task<Result<AuthResponse>> Handle(LoginCommand request, CancellationToken cancellationToken)
    {
        var user = await _unitOfWork.Users.GetByEmailAsync(request.Email.ToLowerInvariant(), cancellationToken);
        if (user == null)
        {
            await _audit.LogAsync(AuditActions.LoginFailed,
                metadata: new { email = request.Email, reason = "no_such_user" },
                cancellationToken: cancellationToken);
            return Result<AuthResponse>.Failure("Invalid email or password.", "INVALID_CREDENTIALS");
        }

        if (!_passwordHasher.Verify(request.Password, user.PasswordHash))
        {
            await _audit.LogAsync(AuditActions.LoginFailed, subjectUserId: user.UserId,
                metadata: new { reason = "bad_password" },
                cancellationToken: cancellationToken);
            return Result<AuthResponse>.Failure("Invalid email or password.", "INVALID_CREDENTIALS");
        }

        if (!user.IsEmailVerified)
            return Result<AuthResponse>.Failure("Email not verified.", "EMAIL_NOT_VERIFIED");

        if (!user.IsActive)
            return Result<AuthResponse>.Failure("Your account has been deactivated. Please contact support.", "ACCOUNT_DEACTIVATED");

        // Second factor, if enrolled: stop here and hand back a challenge instead of a session. No
        // token of any kind is issued on this leg, so a correct password alone buys nothing.
        var factor = await _unitOfWork.UserTwoFactors.GetByUserIdAsync(user.UserId, cancellationToken);
        if (factor is { IsEnabled: true })
        {
            var challenge = await TwoFactorChallenge.IssueAsync(_cache, user.UserId, cancellationToken);
            return Result<AuthResponse>.Success(
                new AuthResponse(
                    user.UserId,
                    user.Email,
                    user.FullName,
                    string.Empty,
                    string.Empty,
                    DateTime.UtcNow,
                    TwoFactorRequired: true,
                    ChallengeToken: challenge),
                "Enter the code from your authenticator app.");
        }

        var accessToken = _tokenService.GenerateAccessToken(user);
        var refreshTokenValue = _tokenService.GenerateRefreshToken();
        var refreshToken = RefreshTokenFactory.Create(user.UserId, refreshTokenValue, _requestContext);

        await _unitOfWork.RefreshTokens.AddAsync(refreshToken, cancellationToken);
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        await _audit.LogAsync(AuditActions.LoginSucceeded, user.UserId,
            metadata: new { method = "password" }, cancellationToken: cancellationToken);

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
