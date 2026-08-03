namespace StudyPlatform.Application.Services;

/// <summary>
/// RFC 6238 time-based one-time passwords, in the shape every authenticator app expects:
/// SHA-1, 6 digits, 30-second steps.
///
/// <para>Those parameters are not tunable here on purpose. They are the only combination Google
/// Authenticator and its clones read reliably from an <c>otpauth://</c> URI, so a "stronger" choice
/// would produce a QR code that scans and then never yields an accepted code.</para>
/// </summary>
public interface ITotpService
{
    /// <summary>A fresh 160-bit secret, base32-encoded for the provisioning URI.</summary>
    string GenerateSecret();

    /// <summary>
    /// The <c>otpauth://totp/...</c> URI an authenticator app scans. <paramref name="issuer"/> and
    /// <paramref name="accountName"/> are what the user sees in their app's list.
    /// </summary>
    string BuildProvisioningUri(string secretBase32, string issuer, string accountName);

    /// <summary>
    /// Checks a user-entered code against the secret, allowing one step of clock skew either way.
    ///
    /// <para>Returns the step the code matched so the caller can persist it and refuse a replay
    /// within the same window; null when nothing in the window matches.</para>
    /// </summary>
    long? Verify(string secretBase32, string code, long minimumStepExclusive = 0);
}
