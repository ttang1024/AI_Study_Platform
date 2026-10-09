using System.Security.Cryptography;
using System.Text;
using StudyPlatform.Domain.Entities;

namespace StudyPlatform.Application.Auth;

/// <summary>
/// Issuing and checking the six-digit email codes that gate registration and password reset.
///
/// <para>A six-digit code is only safe with a cap on guesses: without one, the 900,000 possibilities fall
/// to a few minutes of scripted requests, and a reset code is an account takeover. So a code is checked
/// against the single active row for that email and purpose (sending a new code invalidates the old
/// ones), each wrong guess is counted on that row, and the row is burned at
/// <see cref="MaxFailedAttempts"/> — after which only a freshly emailed code works.</para>
/// </summary>
public static class OtpVerifier
{
    public const int MaxFailedAttempts = 5;

    public static string GenerateCode() => RandomNumberGenerator.GetInt32(100_000, 1_000_000).ToString();

    /// <summary>Codes are stored and looked up under one spelling of the address.</summary>
    public static string NormalizeEmail(string email) => email.Trim().ToLowerInvariant();

    /// <summary>
    /// True when <paramref name="submittedCode"/> matches the active <paramref name="otp"/>, which is then
    /// marked used. A mismatch counts against the row and burns it on the last allowed attempt; either
    /// way the caller must save the unit of work so the outcome sticks.
    /// </summary>
    public static bool TryConsume(OtpCode? otp, string? submittedCode)
    {
        if (otp == null || otp.IsUsed || otp.FailedAttempts >= MaxFailedAttempts)
            return false;

        var matches = CryptographicOperations.FixedTimeEquals(
            Encoding.UTF8.GetBytes(otp.Code),
            Encoding.UTF8.GetBytes(submittedCode?.Trim() ?? string.Empty));

        if (matches)
        {
            otp.IsUsed = true;
            return true;
        }

        otp.FailedAttempts++;
        if (otp.FailedAttempts >= MaxFailedAttempts)
            otp.IsUsed = true;
        return false;
    }
}
