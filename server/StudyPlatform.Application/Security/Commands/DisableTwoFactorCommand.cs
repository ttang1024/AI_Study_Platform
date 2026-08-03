using MediatR;
using StudyPlatform.Application.Common;
using StudyPlatform.Application.Services;
using StudyPlatform.Domain.Interfaces;

namespace StudyPlatform.Application.Security.Commands;

/// <summary>
/// Turns the second factor off. Requires the password: an access token alone must not be enough to
/// remove the protection that exists precisely for the case where a token has been taken.
/// </summary>
public record DisableTwoFactorCommand(Guid UserId, string Password) : IRequest<Result>;

public class DisableTwoFactorCommandHandler : IRequestHandler<DisableTwoFactorCommand, Result>
{
    private readonly IUnitOfWork _unitOfWork;
    private readonly IPasswordHasher _hasher;
    private readonly IAuditLogger _audit;

    public DisableTwoFactorCommandHandler(IUnitOfWork unitOfWork, IPasswordHasher hasher, IAuditLogger audit)
    {
        _unitOfWork = unitOfWork;
        _hasher = hasher;
        _audit = audit;
    }

    public async Task<Result> Handle(DisableTwoFactorCommand request, CancellationToken cancellationToken)
    {
        var user = await _unitOfWork.Users.GetByIdAsync(request.UserId, cancellationToken);
        if (user == null)
            return Result.Failure("User not found.", "USER_NOT_FOUND");

        if (!_hasher.Verify(request.Password, user.PasswordHash))
            return Result.Failure("Password is incorrect.", "INVALID_PASSWORD");

        var factor = await _unitOfWork.UserTwoFactors.GetByUserIdAsync(request.UserId, cancellationToken);
        if (factor == null || !factor.IsEnabled)
            return Result.Failure("Two-factor authentication is not enabled.", "TWO_FACTOR_NOT_ENABLED");

        // Removed rather than flagged off: a disabled row would keep a working secret and a set of
        // live recovery-code hashes on an account the user believes is no longer protected by them.
        _unitOfWork.UserTwoFactors.Remove(factor);
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        await _audit.LogAsync(AuditActions.TwoFactorDisabled, request.UserId,
            cancellationToken: cancellationToken);

        return Result.Success("Two-factor authentication has been turned off.");
    }
}
