using StudyPlatform.Domain.Entities;

namespace StudyPlatform.Domain.Interfaces;

public interface IRefreshTokenRepository : IRepository<RefreshToken>
{
    /// <summary>The row with this token digest, revoked or not, untracked — reuse detection needs both.</summary>
    Task<RefreshToken?> FindByHashAsync(string tokenHash, CancellationToken cancellationToken = default);

    /// <summary>
    /// Revokes one token if, and only if, it is still live — a single conditional UPDATE, so of two
    /// concurrent refreshes with the same token exactly one gets <c>true</c>. Applied immediately, not
    /// on the next SaveChanges.
    /// </summary>
    Task<bool> TryRevokeAsync(Guid tokenId, CancellationToken cancellationToken = default);

    /// <summary>Revokes every live token of one sign-in (all its rotations). Applied immediately.</summary>
    Task RevokeSessionAsync(Guid userId, Guid sessionId, CancellationToken cancellationToken = default);

    Task RevokeAllUserTokensAsync(Guid userId, CancellationToken cancellationToken = default);
}
