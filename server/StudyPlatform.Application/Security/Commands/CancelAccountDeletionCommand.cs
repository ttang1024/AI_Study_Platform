using MediatR;
using StudyPlatform.Application.Common;
using StudyPlatform.Application.Services;
using StudyPlatform.Domain.Interfaces;

namespace StudyPlatform.Application.Security.Commands;

/// <summary>
/// Calls off a scheduled deletion and reactivates the account.
///
/// <para>Takes the password rather than a session, because requesting deletion revokes every
/// session — there is no logged-in state left to cancel from.</para>
/// </summary>
public record CancelAccountDeletionCommand(string Email, string Password) : IRequest<Result>;

public class CancelAccountDeletionCommandHandler : IRequestHandler<CancelAccountDeletionCommand, Result>
{
    private readonly IUnitOfWork _unitOfWork;
    private readonly IPasswordHasher _hasher;
    private readonly IAuditLogger _audit;

    public CancelAccountDeletionCommandHandler(
        IUnitOfWork unitOfWork, IPasswordHasher hasher, IAuditLogger audit)
    {
        _unitOfWork = unitOfWork;
        _hasher = hasher;
        _audit = audit;
    }

    public async Task<Result> Handle(CancelAccountDeletionCommand request, CancellationToken cancellationToken)
    {
        var user = await _unitOfWork.Users.GetByEmailAsync(
            request.Email.ToLowerInvariant(), cancellationToken);

        // One message for every failure: this endpoint is reachable without a session, so
        // distinguishing "no such account" from "wrong password" would make it an oracle.
        if (user == null || !_hasher.Verify(request.Password, user.PasswordHash))
            return Result.Failure("Invalid email or password.", "INVALID_CREDENTIALS");

        if (user.DeletionRequestedAt == null)
            return Result.Failure("This account isn't scheduled for deletion.", "NO_DELETION_PENDING");

        user.DeletionRequestedAt = null;
        user.IsActive = true;
        user.UpdatedAt = DateTime.UtcNow;
        _unitOfWork.Users.Update(user);
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        await _audit.LogAsync("account.deletion.cancelled", user.UserId,
            cancellationToken: cancellationToken);

        return Result.Success("Account deletion cancelled. You can log in again.");
    }
}
