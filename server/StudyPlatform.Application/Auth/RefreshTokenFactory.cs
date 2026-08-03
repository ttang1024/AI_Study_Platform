using StudyPlatform.Application.Services;
using StudyPlatform.Domain.Entities;

namespace StudyPlatform.Application.Auth;

/// <summary>
/// Builds the refresh-token row that represents a session.
///
/// <para>Shared by every path that signs a user in — password, OAuth, registration, the second leg
/// of a 2FA login, and refresh itself. Centralised because the session list is only as trustworthy
/// as its least-annotated row: one login path that forgot to stamp the device would show up as an
/// unidentifiable session, which is precisely the row a user is scanning for.</para>
/// </summary>
public static class RefreshTokenFactory
{
    public static readonly TimeSpan Lifetime = TimeSpan.FromDays(7);

    /// <param name="sessionId">
    /// Pass the rotating token's existing session id so the sign-in keeps its identity; omit it at
    /// sign-in to start a new session.
    /// </param>
    public static RefreshToken Create(
        Guid userId, string tokenValue, IRequestContext? context = null, Guid? sessionId = null)
    {
        var now = DateTime.UtcNow;
        return new RefreshToken
        {
            TokenId = Guid.NewGuid(),
            SessionId = sessionId ?? Guid.NewGuid(),
            UserId = userId,
            Token = tokenValue,
            ExpiresAt = now.Add(Lifetime),
            IsRevoked = false,
            CreatedAt = now,
            LastUsedAt = now,
            DeviceName = context?.DeviceName,
            UserAgent = context?.UserAgent,
            IpAddress = context?.IpAddress,
        };
    }
}
