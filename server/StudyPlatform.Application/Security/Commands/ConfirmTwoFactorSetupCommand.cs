using MediatR;
using StudyPlatform.Application.Common;
using StudyPlatform.Application.Security.DTOs;
using StudyPlatform.Application.Services;
using StudyPlatform.Domain.Interfaces;

namespace StudyPlatform.Application.Security.Commands;

/// <summary>
/// Completes enrolment: a valid code proves the secret reached the authenticator, so the factor is
/// switched on and recovery codes are issued.
/// </summary>
public record ConfirmTwoFactorSetupCommand(Guid UserId, string Code) : IRequest<Result<TwoFactorEnabledDto>>;

public class ConfirmTwoFactorSetupCommandHandler
    : IRequestHandler<ConfirmTwoFactorSetupCommand, Result<TwoFactorEnabledDto>>
{
    private readonly IUnitOfWork _unitOfWork;
    private readonly ITotpService _totp;
    private readonly IPasswordHasher _hasher;
    private readonly IAuditLogger _audit;

    public ConfirmTwoFactorSetupCommandHandler(
        IUnitOfWork unitOfWork,
        ITotpService totp,
        IPasswordHasher hasher,
        IAuditLogger audit)
    {
        _unitOfWork = unitOfWork;
        _totp = totp;
        _hasher = hasher;
        _audit = audit;
    }

    public async Task<Result<TwoFactorEnabledDto>> Handle(
        ConfirmTwoFactorSetupCommand request, CancellationToken cancellationToken)
    {
        var factor = await _unitOfWork.UserTwoFactors.GetByUserIdAsync(request.UserId, cancellationToken);
        if (factor == null)
            return Result<TwoFactorEnabledDto>.Failure(
                "Start two-factor setup before confirming.", "TWO_FACTOR_SETUP_NOT_STARTED");

        if (factor.IsEnabled)
            return Result<TwoFactorEnabledDto>.Failure(
                "Two-factor authentication is already enabled.", "TWO_FACTOR_ALREADY_ENABLED");

        var step = _totp.Verify(factor.SecretBase32, request.Code, factor.LastUsedStep);
        if (step == null)
        {
            await _audit.LogAsync(AuditActions.TwoFactorChallengeFailed, request.UserId,
                metadata: new { phase = "setup" }, cancellationToken: cancellationToken);
            return Result<TwoFactorEnabledDto>.Failure(
                "That code isn't valid. Check your authenticator app and try again.", "INVALID_TOTP_CODE");
        }

        var codes = TwoFactorCodes.Generate();

        factor.IsEnabled = true;
        factor.EnabledAt = DateTime.UtcNow;
        factor.UpdatedAt = DateTime.UtcNow;
        factor.LastUsedStep = step.Value;
        factor.RecoveryCodeHashesJson = TwoFactorCodes.HashAll(codes, _hasher);
        _unitOfWork.UserTwoFactors.Update(factor);

        await _unitOfWork.SaveChangesAsync(cancellationToken);
        await _audit.LogAsync(AuditActions.TwoFactorEnabled, request.UserId,
            cancellationToken: cancellationToken);

        return Result<TwoFactorEnabledDto>.Success(
            new TwoFactorEnabledDto(codes),
            "Two-factor authentication is on. Save these recovery codes — they won't be shown again.");
    }
}
