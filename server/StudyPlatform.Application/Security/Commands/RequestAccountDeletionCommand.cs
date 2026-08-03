using MediatR;
using StudyPlatform.Application.Common;
using StudyPlatform.Application.Services;
using StudyPlatform.Domain.Interfaces;

namespace StudyPlatform.Application.Security.Commands;

/// <summary>
/// Starts account deletion: deactivates, cuts every session, and schedules the erase.
///
/// <para>Nothing is destroyed here. The user loses access at once — which is what they asked for —
/// but the data survives <see cref="GracePeriod"/> so a request made in anger or by mistake can
/// still be undone.</para>
/// </summary>
public record RequestAccountDeletionCommand(Guid UserId, string Password, string Confirmation)
    : IRequest<Result<DateTime>>;

public class RequestAccountDeletionCommandHandler
    : IRequestHandler<RequestAccountDeletionCommand, Result<DateTime>>
{
    public static readonly TimeSpan GracePeriod = TimeSpan.FromDays(7);

    /// <summary>
    /// The phrase the user has to type. A second, deliberate action on the one operation that
    /// cannot be walked back — a password field alone is muscle memory for most people.
    /// </summary>
    public const string RequiredConfirmation = "DELETE MY ACCOUNT";

    private readonly IUnitOfWork _unitOfWork;
    private readonly IPasswordHasher _hasher;
    private readonly IAuditLogger _audit;

    public RequestAccountDeletionCommandHandler(
        IUnitOfWork unitOfWork, IPasswordHasher hasher, IAuditLogger audit)
    {
        _unitOfWork = unitOfWork;
        _hasher = hasher;
        _audit = audit;
    }

    public async Task<Result<DateTime>> Handle(
        RequestAccountDeletionCommand request, CancellationToken cancellationToken)
    {
        var user = await _unitOfWork.Users.GetByIdAsync(request.UserId, cancellationToken);
        if (user == null)
            return Result<DateTime>.Failure("User not found.", "USER_NOT_FOUND");

        if (!string.Equals(request.Confirmation?.Trim(), RequiredConfirmation, StringComparison.Ordinal))
            return Result<DateTime>.Failure(
                $"Type \"{RequiredConfirmation}\" to confirm.", "CONFIRMATION_MISMATCH");

        if (!_hasher.Verify(request.Password, user.PasswordHash))
            return Result<DateTime>.Failure("Password is incorrect.", "INVALID_PASSWORD");

        if (user.DeletionRequestedAt != null)
            return Result<DateTime>.Failure(
                "Your account is already scheduled for deletion.", "DELETION_ALREADY_REQUESTED");

        var now = DateTime.UtcNow;
        user.DeletionRequestedAt = now;
        user.IsActive = false;
        user.UpdatedAt = now;
        _unitOfWork.Users.Update(user);

        // Immediately, not on the worker's schedule: the account is closed from this moment, and a
        // live session would otherwise keep working for the whole grace period.
        await _unitOfWork.RefreshTokens.RevokeAllUserTokensAsync(request.UserId, cancellationToken);

        await _unitOfWork.SaveChangesAsync(cancellationToken);

        var scheduledFor = now.Add(GracePeriod);
        await _audit.LogAsync(AuditActions.AccountDeletionRequested, request.UserId,
            metadata: new { scheduledFor }, cancellationToken: cancellationToken);

        return Result<DateTime>.Success(scheduledFor,
            $"Your account is scheduled for deletion on {scheduledFor:yyyy-MM-dd}. Log in before then to cancel.");
    }
}
