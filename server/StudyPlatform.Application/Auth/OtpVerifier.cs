using System.Security.Cryptography;
using System.Text;
using StudyPlatform.Domain.Entities;
using StudyPlatform.Domain.Interfaces;

namespace StudyPlatform.Application.Auth;

/// <summary>
/// Issuing and checking the six-digit email codes that gate registration and password reset.
///
/// <para>A six-digit code is only safe with a cap on guesses: without one, the 900,000 possibilities fall
/// to a few minutes of scripted requests, and a reset code is an account takeover. So a code is checked
/// against the single active row for that email and purpose (sending a new code invalidates the old
/// ones), and every guess — counted in the database before it is compared — spends one of
/// <see cref="MaxFailedAttempts"/>. The count and the consume are each one conditional UPDATE: counting
/// on the loaded entity and saving it let concurrent guesses all read the same count, which turned the
/// cap into nothing more than the per-IP rate limit.</para>
/// </summary>
public static class OtpVerifier
{
    /// <summary>Guesses allowed per code, the correct one included.</summary>
    public const int MaxFailedAttempts = 5;

    public static string GenerateCode() => RandomNumberGenerator.GetInt32(100_000, 1_000_000).ToString();

    /// <summary>Codes are stored and looked up under one spelling of the address.</summary>
    public static string NormalizeEmail(string email) => email.Trim().ToLowerInvariant();

    /// <summary>
    /// True when <paramref name="submittedCode"/> matches the active <paramref name="otp"/>, which is then
    /// used up. Both writes happen here, immediately — callers must not save <paramref name="otp"/>
    /// themselves, which would write its stale loaded counters back over them.
    /// </summary>
    public static async Task<bool> TryConsumeAsync(
        IOtpRepository otps, OtpCode? otp, string? submittedCode, CancellationToken cancellationToken = default)
    {
        if (otp == null || !await otps.TryCountAttemptAsync(otp.OtpId, MaxFailedAttempts, cancellationToken))
            return false;

        var matches = CryptographicOperations.FixedTimeEquals(
            Encoding.UTF8.GetBytes(otp.Code),
            Encoding.UTF8.GetBytes(submittedCode?.Trim() ?? string.Empty));

        // Two concurrent correct guesses: only the one that flips IsUsed gets through.
        return matches && await otps.TryMarkUsedAsync(otp.OtpId, cancellationToken);
    }
}
