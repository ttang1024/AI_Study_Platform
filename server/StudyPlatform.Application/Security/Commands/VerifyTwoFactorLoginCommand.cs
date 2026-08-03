using MediatR;
using StudyPlatform.Application.Auth;
using StudyPlatform.Application.Auth.DTOs;
using StudyPlatform.Application.Common;
using StudyPlatform.Application.Services;
using StudyPlatform.Domain.Interfaces;

namespace StudyPlatform.Application.Security.Commands;

/// <summary>
/// The second leg of a 2FA login: exchanges a challenge handle plus a code for real tokens.
///
/// <para>Accepts either a TOTP code or a recovery code, tried in that order. A user reaching for a
/// recovery code has usually lost the authenticator, so there is no separate endpoint to pick —
/// one field, and the server works out which kind it got.</para>
/// </summary>
public record VerifyTwoFactorLoginCommand(string ChallengeToken, string Code) : IRequest<Result<AuthResponse>>;

public class VerifyTwoFactorLoginCommandHandler
    : IRequestHandler<VerifyTwoFactorLoginCommand, Result<AuthResponse>>
{
    private readonly IUnitOfWork _unitOfWork;
    private readonly IAppCache _cache;
    private readonly ITotpService _totp;
    private readonly ITokenService _tokenService;
    private readonly IPasswordHasher _hasher;
    private readonly IRequestContext _requestContext;
    private readonly IAuditLogger _audit;

    public VerifyTwoFactorLoginCommandHandler(
        IUnitOfWork unitOfWork,
        IAppCache cache,
        ITotpService totp,
        ITokenService tokenService,
        IPasswordHasher hasher,
        IRequestContext requestContext,
        IAuditLogger audit)
    {
        _unitOfWork = unitOfWork;
        _cache = cache;
        _totp = totp;
        _tokenService = tokenService;
        _hasher = hasher;
        _requestContext = requestContext;
        _audit = audit;
    }

    public async Task<Result<AuthResponse>> Handle(
        VerifyTwoFactorLoginCommand request, CancellationToken cancellationToken)
    {
        var userId = await TwoFactorChallenge.ResolveAsync(_cache, request.ChallengeToken, cancellationToken);
        if (userId == null)
            return Result<AuthResponse>.Failure(
                "This sign-in attempt expired. Please log in again.", "CHALLENGE_EXPIRED");

        var user = await _unitOfWork.Users.GetByIdAsync(userId.Value, cancellationToken);
        var factor = await _unitOfWork.UserTwoFactors.GetByUserIdAsync(userId.Value, cancellationToken);

        // Re-checked here rather than trusted from the first leg: minutes can pass between the two,
        // and an account deactivated in between must not still be able to complete a login.
        if (user == null || !user.IsActive || factor is not { IsEnabled: true })
        {
            await TwoFactorChallenge.ConsumeAsync(_cache, request.ChallengeToken, cancellationToken);
            return Result<AuthResponse>.Failure(
                "This sign-in attempt is no longer valid. Please log in again.", "CHALLENGE_EXPIRED");
        }

        var step = _totp.Verify(factor.SecretBase32, request.Code, factor.LastUsedStep);
        var usedRecoveryCode = false;

        if (step != null)
        {
            factor.LastUsedStep = step.Value;
        }
        else
        {
            var remaining = TwoFactorCodes.Redeem(request.Code, factor.RecoveryCodeHashesJson, _hasher);
            if (remaining == null)
            {
                await _audit.LogAsync(AuditActions.TwoFactorChallengeFailed, user.UserId,
                    metadata: new { phase = "login" }, cancellationToken: cancellationToken);
                return Result<AuthResponse>.Failure(
                    "That code isn't valid.", "INVALID_TOTP_CODE");
            }

            factor.RecoveryCodeHashesJson = TwoFactorCodes.WriteHashes(remaining);
            usedRecoveryCode = true;
        }

        factor.UpdatedAt = DateTime.UtcNow;
        _unitOfWork.UserTwoFactors.Update(factor);

        var accessToken = _tokenService.GenerateAccessToken(user);
        var refreshTokenValue = _tokenService.GenerateRefreshToken();
        var refreshToken = RefreshTokenFactory.Create(user.UserId, refreshTokenValue, _requestContext);

        await _unitOfWork.RefreshTokens.AddAsync(refreshToken, cancellationToken);
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        // Burned on success so a challenge observed in transit cannot be redeemed for a second session.
        await TwoFactorChallenge.ConsumeAsync(_cache, request.ChallengeToken, cancellationToken);

        if (usedRecoveryCode)
        {
            await _audit.LogAsync(AuditActions.TwoFactorRecoveryUsed, user.UserId,
                metadata: new { remaining = TwoFactorCodes.ReadHashes(factor.RecoveryCodeHashesJson).Count },
                cancellationToken: cancellationToken);
        }

        await _audit.LogAsync(AuditActions.LoginSucceeded, user.UserId,
            metadata: new { method = usedRecoveryCode ? "2fa_recovery" : "2fa_totp" },
            cancellationToken: cancellationToken);

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
