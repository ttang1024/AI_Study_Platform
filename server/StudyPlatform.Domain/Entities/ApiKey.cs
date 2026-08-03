namespace StudyPlatform.Domain.Entities;

/// <summary>
/// A long-lived credential for programmatic access, standing in for a user.
///
/// <para>Only a hash of the key is stored, so the plaintext exists once — in the response that
/// created it. <see cref="Prefix"/> is kept in the clear purely so the owner can tell their keys
/// apart in a list without the platform having to be able to reproduce them.</para>
/// </summary>
public class ApiKey
{
    public Guid ApiKeyId { get; set; }
    public Guid UserId { get; set; }

    /// <summary>What the user called it — "CI", "my script". Theirs, not ours.</summary>
    public string Name { get; set; } = string.Empty;

    /// <summary>
    /// SHA-256 of the key, hex-encoded.
    ///
    /// <para>A fast hash, deliberately, where passwords get a slow one. The reason a password needs
    /// BCrypt is that people choose guessable passwords; an API key is 256 bits from a CSPRNG, so
    /// there is no dictionary to run and nothing for a work factor to buy. What a work factor would
    /// cost is real: this hash is computed on every single API request.</para>
    /// </summary>
    public string KeyHash { get; set; } = string.Empty;

    /// <summary>First few characters of the key, e.g. <c>sk_live_a1b2c3</c>. Display only.</summary>
    public string Prefix { get; set; } = string.Empty;

    /// <summary>
    /// Comma-separated scope names limiting what the key can do.
    ///
    /// <para>A string rather than rows because scopes are always read as a whole set on the request
    /// path, never queried across — and that path is the hot one.</para>
    /// </summary>
    public string Scopes { get; set; } = string.Empty;

    /// <summary>
    /// Bumped, at most once a minute, when the key is used. Coarse on purpose: an exact timestamp
    /// would mean a database write on every authenticated API call to power a "last used" label.
    /// </summary>
    public DateTime? LastUsedAt { get; set; }

    public DateTime? ExpiresAt { get; set; }

    /// <summary>Set when revoked. Kept so the key list can show what was withdrawn, and when.</summary>
    public DateTime? RevokedAt { get; set; }

    public DateTime CreatedAt { get; set; }

    public User User { get; set; } = null!;

    /// <summary>True when the key should still authenticate.</summary>
    public bool IsUsable(DateTime now)
        => RevokedAt == null && (ExpiresAt == null || ExpiresAt > now);
}

/// <summary>
/// What an API key is allowed to do. Read and write are separated because the common case for a
/// key — a script that syncs a library elsewhere — needs neither the ability to delete nor the
/// ability to spend the owner's AI quota.
/// </summary>
public static class ApiKeyScopes
{
    public const string ReadLibrary = "library:read";
    public const string WriteLibrary = "library:write";
    public const string ReadFlashcards = "flashcards:read";
    public const string WriteFlashcards = "flashcards:write";
    public const string ReadAnalytics = "analytics:read";

    public static readonly IReadOnlyList<string> All = new[]
    {
        ReadLibrary, WriteLibrary, ReadFlashcards, WriteFlashcards, ReadAnalytics,
    };

    public static bool IsValid(string scope) => All.Contains(scope);
}
