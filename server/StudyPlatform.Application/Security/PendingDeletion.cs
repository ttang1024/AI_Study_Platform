using StudyPlatform.Domain.Entities;

namespace StudyPlatform.Application.Security;

/// <summary>
/// Signing in during the grace period is how a scheduled deletion is called off: requesting deletion
/// revokes every session, so there is nothing left to cancel from except a fresh sign-in.
/// </summary>
public static class PendingDeletion
{
    /// <summary>
    /// Reactivates <paramref name="user"/> if it is closed only because deletion was requested.
    /// Call after the credentials are proven; the caller's save persists the change.
    /// </summary>
    public static void CancelOnSignIn(User user)
    {
        if (user.DeletionRequestedAt == null) return;

        user.DeletionRequestedAt = null;
        user.IsActive = true;
        user.UpdatedAt = DateTime.UtcNow;
    }
}
