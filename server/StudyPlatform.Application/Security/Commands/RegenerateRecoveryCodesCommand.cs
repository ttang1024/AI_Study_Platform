using MediatR;
using StudyPlatform.Application.Common;
using StudyPlatform.Application.Security.DTOs;
using StudyPlatform.Application.Services;
using StudyPlatform.Domain.Interfaces;

namespace StudyPlatform.Application.Security.Commands;

/// <summary>
/// Issues a fresh set of recovery codes, invalidating every previous one.
///
/// <para>Password-gated for the same reason disabling is: this is the path a user takes when they
/// think their old codes leaked, so it must not be reachable with a stolen access token alone.</para>
/// </summary>
public record RegenerateRecoveryCodesCommand(Guid UserId, string Password)
    : IRequest<Result<TwoFactorEnabledDto>>;

public class RegenerateRecoveryCodesCommandHandler
    : IRequestHandler<RegenerateRecoveryCodesCommand, Result<TwoFactorEnabledDto>>
{
    private readonly IUnitOfWork _unitOfWork;
    private readonly IPasswordHasher _hasher;
    private readonly IAuditLogger _audit;

    public RegenerateRecoveryCodesCommandHandler(
        IUnitOfWork unitOfWork, IPasswordHasher hasher, IAuditLogger audit)
    {
        _unitOfWork = unitOfWork;
        _hasher = hasher;
        _audit = audit;
    }

    public async Task<Result<TwoFactorEnabledDto>> Handle(
        RegenerateRecoveryCodesCommand request, CancellationToken cancellationToken)
    {
        var user = await _unitOfWork.Users.GetByIdAsync(request.UserId, cancellationToken);
        if (user == null)
            return Result<TwoFactorEnabledDto>.Failure("User not found.", "USER_NOT_FOUND");

        if (!_hasher.Verify(request.Password, user.PasswordHash))
            return Result<TwoFactorEnabledDto>.Failure("Password is incorrect.", "INVALID_PASSWORD");

        var factor = await _unitOfWork.UserTwoFactors.GetByUserIdAsync(request.UserId, cancellationToken);
        if (factor == null || !factor.IsEnabled)
            return Result<TwoFactorEnabledDto>.Failure(
                "Two-factor authentication is not enabled.", "TWO_FACTOR_NOT_ENABLED");

        var codes = TwoFactorCodes.Generate();
        factor.RecoveryCodeHashesJson = TwoFactorCodes.HashAll(codes, _hasher);
        factor.UpdatedAt = DateTime.UtcNow;
        _unitOfWork.UserTwoFactors.Update(factor);

        await _unitOfWork.SaveChangesAsync(cancellationToken);
        await _audit.LogAsync(AuditActions.RecoveryCodesRegenerated, request.UserId,
            cancellationToken: cancellationToken);

        return Result<TwoFactorEnabledDto>.Success(
            new TwoFactorEnabledDto(codes),
            "New recovery codes generated. Your previous codes no longer work.");
    }
}
