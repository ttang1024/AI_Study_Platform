using System.Security.Cryptography;
using System.Text;

namespace StudyPlatform.Application.Auth;

/// <summary>
/// Refresh tokens are stored as a SHA-256 digest, never as the value itself.
///
/// <para>A refresh token is a week-long bearer credential. Stored verbatim, anyone who can read the table
/// — a leaked backup, an over-broad database role — can sign in as every user with a live session. The
/// token is 64 random bytes, so an unsalted fast hash is enough: there is nothing to brute-force.</para>
///
/// <para>Lowercase hex, matching <c>encode(sha256(convert_to(token, 'UTF8')), 'hex')</c> — the expression
/// the AddRefreshTokenHashing migration used to convert the rows that existed before this.</para>
/// </summary>
public static class RefreshTokenHash
{
    public static string Compute(string token)
        => Convert.ToHexStringLower(SHA256.HashData(Encoding.UTF8.GetBytes(token)));
}
