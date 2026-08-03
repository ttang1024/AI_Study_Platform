using System.Security.Cryptography;
using StudyPlatform.Application.Services;

namespace StudyPlatform.Application.Security;

/// <summary>
/// The short-lived handle that ties the two legs of a 2FA login together.
///
/// <para>Kept in <see cref="IAppCache"/> rather than a table: it lives for five minutes, is written
/// once and read once, and expiry is the entire lifecycle — a row would need its own cleanup job to
/// do what a TTL does for free. Going through <c>IAppCache</c> also means it inherits the platform's
/// Redis-to-Postgres fallback, so a Redis outage degrades 2FA logins rather than blocking them.</para>
///
/// <para>The handle proves only that the password leg passed. It is not a credential: it carries no
/// claims, and the code leg re-reads the user from the database before issuing any token.</para>
/// </summary>
public static class TwoFactorChallenge
{
    public static readonly TimeSpan Lifetime = TimeSpan.FromMinutes(5);

    private static string Key(string token) => $"2fa:challenge:{token}";

    public static async Task<string> IssueAsync(IAppCache cache, Guid userId, CancellationToken cancellationToken)
    {
        var token = Convert.ToHexString(RandomNumberGenerator.GetBytes(32));
        await cache.SetAsync(Key(token), userId.ToString(), Lifetime, cancellationToken);
        return token;
    }

    public static async Task<Guid?> ResolveAsync(IAppCache cache, string token, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(token))
            return null;

        var value = await cache.GetAsync<string>(Key(token), cancellationToken);
        return Guid.TryParse(value, out var userId) ? userId : null;
    }

    /// <summary>
    /// Burns the handle. Called on success so a captured challenge cannot be replayed into a second
    /// session, and on a spent recovery code so the same handle cannot be retried indefinitely.
    /// </summary>
    public static Task ConsumeAsync(IAppCache cache, string token, CancellationToken cancellationToken)
        => cache.RemoveAsync(Key(token), cancellationToken);
}
