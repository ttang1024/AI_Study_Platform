namespace StudyPlatform.Domain.Entities;

/// <summary>
/// A user's TOTP second factor, and the recovery codes that get them back in without it.
///
/// <para>The row exists from the moment enrolment starts, not from the moment it succeeds —
/// <see cref="IsEnabled"/> is what gates login. Enrolment has to hand out a secret before the user
/// can prove they stored it, so the secret must be persisted while the factor is still inactive;
/// keeping the pending secret in a cache instead would mean a user who reloads the page mid-setup
/// silently gets a different secret than the one already in their authenticator.</para>
///
/// <para>Re-enrolling overwrites this row rather than adding a second one: one factor per user, so a
/// stale secret from an abandoned setup can never still be a valid way in.</para>
/// </summary>
public class UserTwoFactor
{
    public Guid UserId { get; set; }

    /// <summary>
    /// The shared TOTP secret, base32-encoded — the same form the authenticator app scanned.
    ///
    /// <para>Stored recoverably because TOTP verification has to recompute the code from it, so
    /// unlike a password it cannot be hashed. It is therefore exactly as sensitive as the password
    /// hash column and must never be returned by any read path once enrolment completes; the setup
    /// response is the one and only time it leaves the server.</para>
    /// </summary>
    public string SecretBase32 { get; set; } = string.Empty;

    /// <summary>False while enrolment is pending. Only a true here makes login demand a code.</summary>
    public bool IsEnabled { get; set; }

    public DateTime? EnabledAt { get; set; }

    /// <summary>
    /// JSON array of BCrypt hashes of the unused recovery codes.
    ///
    /// <para>Hashed for the same reason passwords are — each one is a full bypass of the second
    /// factor. Used codes are removed from the array rather than flagged, so the count of remaining
    /// codes is the array length and a code can never be spent twice.</para>
    /// </summary>
    public string RecoveryCodeHashesJson { get; set; } = "[]";

    /// <summary>
    /// The last TOTP step number accepted for this user.
    ///
    /// <para>A TOTP code stays valid for its whole 30-second step, so without this an attacker who
    /// observes one code — over a shoulder, in a phished form — can replay it until the step ends.
    /// Verification rejects any step at or below this value.</para>
    /// </summary>
    public long LastUsedStep { get; set; }

    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }

    public User User { get; set; } = null!;
}
