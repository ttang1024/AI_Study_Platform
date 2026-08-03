namespace StudyPlatform.Domain.Entities;

public class RefreshToken
{
    public Guid TokenId { get; set; }
    public Guid UserId { get; set; }
    public string Token { get; set; } = string.Empty;
    public DateTime ExpiresAt { get; set; }
    public bool IsRevoked { get; set; }
    public DateTime CreatedAt { get; set; }

    /// <summary>
    /// The sign-in this token belongs to, stable across rotation.
    ///
    /// <para>Refresh rotates the token — every refresh revokes the old row and writes a new one — so
    /// the row is not the session. Without this, a "sessions" list would show a device that appeared
    /// minutes ago no matter how long the user had been signed in, and revoking one would only kill
    /// the current fifteen-minute window. The id is minted at sign-in and inherited by every
    /// rotation, so it is the thing a user is actually revoking.</para>
    /// </summary>
    public Guid SessionId { get; set; }

    /// <summary>
    /// Human-readable device label derived from the user agent at issue time, e.g. "Chrome on macOS".
    ///
    /// <para>Derived once and stored rather than parsed on read, because the session list has to keep
    /// naming the device the user actually signed in on — re-deriving from a user agent that has since
    /// changed (a browser update, a shared token) would relabel a session the user is trying to
    /// recognise. Null for tokens issued before session tracking existed.</para>
    /// </summary>
    public string? DeviceName { get; set; }

    public string? UserAgent { get; set; }

    /// <summary>IP the session was created from. Shown so an unfamiliar location is visible to the user.</summary>
    public string? IpAddress { get; set; }

    /// <summary>Bumped on every successful refresh, so the session list can sort by real recency.</summary>
    public DateTime? LastUsedAt { get; set; }

    /// <summary>When the token was revoked, whether by logout, by a revoke-session call, or by a password change.</summary>
    public DateTime? RevokedAt { get; set; }

    public User User { get; set; } = null!;
}
