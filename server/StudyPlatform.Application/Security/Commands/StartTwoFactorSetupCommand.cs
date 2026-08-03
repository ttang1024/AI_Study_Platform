using MediatR;
using StudyPlatform.Application.Common;
using StudyPlatform.Application.Security.DTOs;
using StudyPlatform.Application.Services;
using StudyPlatform.Domain.Entities;
using StudyPlatform.Domain.Interfaces;

namespace StudyPlatform.Application.Security.Commands;

/// <summary>
/// Begins TOTP enrolment: mints a secret and returns the URI an authenticator app scans.
///
/// <para>Does not enable anything. The factor only starts gating login once the user proves they
/// stored the secret by returning a code, which is <see cref="ConfirmTwoFactorSetupCommand"/>.</para>
/// </summary>
public record StartTwoFactorSetupCommand(Guid UserId) : IRequest<Result<TwoFactorSetupDto>>;

public class StartTwoFactorSetupCommandHandler
    : IRequestHandler<StartTwoFactorSetupCommand, Result<TwoFactorSetupDto>>
{
    /// <summary>What the user sees as the account name in their authenticator app.</summary>
    private const string Issuer = "StudyPlatform";

    private readonly IUnitOfWork _unitOfWork;
    private readonly ITotpService _totp;

    public StartTwoFactorSetupCommandHandler(IUnitOfWork unitOfWork, ITotpService totp)
    {
        _unitOfWork = unitOfWork;
        _totp = totp;
    }

    public async Task<Result<TwoFactorSetupDto>> Handle(
        StartTwoFactorSetupCommand request, CancellationToken cancellationToken)
    {
        var user = await _unitOfWork.Users.GetByIdAsync(request.UserId, cancellationToken);
        if (user == null)
            return Result<TwoFactorSetupDto>.Failure("User not found.", "USER_NOT_FOUND");

        var existing = await _unitOfWork.UserTwoFactors.GetByUserIdAsync(request.UserId, cancellationToken);

        // Re-running setup on an already-protected account would hand out a working secret to whoever
        // holds the access token, which is a second factor that defeats itself. Disabling first
        // requires the password, so that is the only way back to enrolment.
        if (existing is { IsEnabled: true })
            return Result<TwoFactorSetupDto>.Failure(
                "Two-factor authentication is already enabled. Disable it first to re-enrol.",
                "TWO_FACTOR_ALREADY_ENABLED");

        var secret = _totp.GenerateSecret();
        var now = DateTime.UtcNow;

        if (existing == null)
        {
            await _unitOfWork.UserTwoFactors.AddAsync(new UserTwoFactor
            {
                UserId = request.UserId,
                SecretBase32 = secret,
                IsEnabled = false,
                RecoveryCodeHashesJson = "[]",
                CreatedAt = now,
                UpdatedAt = now,
            }, cancellationToken);
        }
        else
        {
            // An abandoned enrolment leaves a pending row behind. Overwriting its secret keeps one
            // factor per user and makes the newest QR code the only one that can ever work.
            existing.SecretBase32 = secret;
            existing.LastUsedStep = 0;
            existing.UpdatedAt = now;
            _unitOfWork.UserTwoFactors.Update(existing);
        }

        await _unitOfWork.SaveChangesAsync(cancellationToken);

        var uri = _totp.BuildProvisioningUri(secret, Issuer, user.Email);
        return Result<TwoFactorSetupDto>.Success(
            new TwoFactorSetupDto(secret, uri),
            "Scan the QR code with your authenticator app, then confirm with a code.");
    }
}
