using StudyPlatform.Domain.Entities;

namespace StudyPlatform.Domain.Interfaces;

/// <summary>
/// One sign-in, collapsed from however many rotated tokens it has produced.
///
/// <para><see cref="StartedAt"/> is when the user actually signed in, not when the current token was
/// issued — that is the difference between a useful session list and one where every row claims to
/// be minutes old.</para>
/// </summary>
public record ActiveSession(
    Guid SessionId,
    string? DeviceName,
    string? IpAddress,
    DateTime StartedAt,
    DateTime? LastUsedAt,
    DateTime ExpiresAt,
    bool IsCurrent);

public interface IRefreshTokenRepository : IRepository<RefreshToken>
{
    Task<RefreshToken?> GetValidTokenAsync(string token, CancellationToken cancellationToken = default);
    Task RevokeAllUserTokensAsync(Guid userId, CancellationToken cancellationToken = default);

    /// <summary>
    /// The user's live sessions, most recently used first. <paramref name="currentToken"/> flags the
    /// caller's own so the UI can warn before someone signs themselves out.
    /// </summary>
    Task<IReadOnlyList<ActiveSession>> GetActiveSessionsAsync(
        Guid userId, string? currentToken, CancellationToken cancellationToken = default);

    /// <summary>
    /// Revokes every token in one session, scoped by user id so a guessed session id belonging to
    /// someone else finds nothing. False when there was nothing live to revoke.
    /// </summary>
    Task<bool> RevokeSessionAsync(Guid userId, Guid sessionId, CancellationToken cancellationToken = default);

    /// <summary>
    /// Revokes every session but the one presented. Returns the number of sessions ended, not tokens,
    /// since that is what the user is told.
    /// </summary>
    Task<int> RevokeOtherSessionsAsync(
        Guid userId, string? currentToken, CancellationToken cancellationToken = default);
}
