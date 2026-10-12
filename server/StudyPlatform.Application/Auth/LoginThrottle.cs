using StudyPlatform.Application.Services;

namespace StudyPlatform.Application.Auth;

/// <summary>
/// Caps password guesses per account. The IP rate limit alone lets a distributed attacker try a
/// password list against one account from many addresses; this counts failures against the email
/// itself, whichever address they come from.
/// </summary>
public interface ILoginThrottle
{
    /// <summary>True while the account has used up its failed attempts for the current window.</summary>
    Task<bool> IsLockedOutAsync(string email, CancellationToken cancellationToken = default);

    Task RecordFailureAsync(string email, CancellationToken cancellationToken = default);

    Task ResetAsync(string email, CancellationToken cancellationToken = default);
}

/// <summary>
/// <see cref="ILoginThrottle"/> over <see cref="IAppCache"/>, so the count survives without Redis (it falls
/// through to the Postgres cache tier) and is shared across replicas when Redis is on. The
/// read-increment-write is not atomic: two simultaneous failures can count as one, which loosens the cap
/// by a guess or two but never locks anyone out early.
///
/// <para>The window is fixed from the first failure rather than sliding, so a locked-out owner waits at
/// most <see cref="Window"/> — the trade-off against an attacker deliberately locking an account out.</para>
/// </summary>
public sealed class LoginThrottle : ILoginThrottle
{
    public const int MaxFailedAttempts = 5;
    public static readonly TimeSpan Window = TimeSpan.FromMinutes(15);

    private readonly IAppCache _cache;

    public LoginThrottle(IAppCache cache) => _cache = cache;

    public async Task<bool> IsLockedOutAsync(string email, CancellationToken cancellationToken = default)
    {
        var state = await _cache.GetAsync<FailureWindow>(Key(email), cancellationToken);
        return state is not null && state.Failures >= MaxFailedAttempts && state.ExpiresAt > DateTime.UtcNow;
    }

    public async Task RecordFailureAsync(string email, CancellationToken cancellationToken = default)
    {
        var key = Key(email);
        var now = DateTime.UtcNow;
        var state = await _cache.GetAsync<FailureWindow>(key, cancellationToken);
        var next = state is null || state.ExpiresAt <= now
            ? new FailureWindow(1, now.Add(Window))
            : state with { Failures = state.Failures + 1 };

        await _cache.SetAsync(key, next, next.ExpiresAt - now, cancellationToken);
    }

    public Task ResetAsync(string email, CancellationToken cancellationToken = default)
        => _cache.RemoveAsync(Key(email), cancellationToken);

    private static string Key(string email) => $"login-failures:{OtpVerifier.NormalizeEmail(email)}";

    public sealed record FailureWindow(int Failures, DateTime ExpiresAt);
}
