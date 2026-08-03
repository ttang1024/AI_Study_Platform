using System.Security.Cryptography;
using System.Text.Json;
using StudyPlatform.Application.Services;

namespace StudyPlatform.Application.Security;

/// <summary>
/// Generation, storage shape, and redemption of recovery codes.
///
/// <para>Shared between enrolment, regeneration, and the login challenge so all three agree on the
/// format. A recovery code is a full bypass of the second factor, so it is treated exactly like a
/// password: hashed with the same hasher, compared only by verify, never read back.</para>
/// </summary>
public static class TwoFactorCodes
{
    public const int CodeCount = 10;

    /// <summary>
    /// Ten codes of 10 base32 characters — 50 bits each, which is far beyond guessable against a
    /// login that also needs the password, and still short enough to be written on paper accurately.
    /// </summary>
    private const int CodeLength = 10;

    private const string Alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

    public static IReadOnlyList<string> Generate()
        => Enumerable.Range(0, CodeCount).Select(_ => GenerateOne()).ToList();

    private static string GenerateOne()
    {
        var chars = new char[CodeLength];
        for (var i = 0; i < CodeLength; i++)
            chars[i] = Alphabet[RandomNumberGenerator.GetInt32(Alphabet.Length)];

        // Grouped for transcription; normalisation strips the separator again on the way back in.
        return $"{new string(chars, 0, 5)}-{new string(chars, 5, 5)}";
    }

    public static string HashAll(IEnumerable<string> codes, IPasswordHasher hasher)
        => JsonSerializer.Serialize(codes.Select(c => hasher.Hash(Normalize(c))).ToList());

    public static List<string> ReadHashes(string? json)
    {
        if (string.IsNullOrWhiteSpace(json))
            return new List<string>();

        try
        {
            return JsonSerializer.Deserialize<List<string>>(json) ?? new List<string>();
        }
        catch (JsonException)
        {
            return new List<string>();
        }
    }

    public static string WriteHashes(IEnumerable<string> hashes)
        => JsonSerializer.Serialize(hashes.ToList());

    /// <summary>
    /// Spends a code if it matches. Returns the remaining hashes with the matched one removed, or
    /// null when nothing matched — a code is single-use, so redemption and removal are one step.
    /// </summary>
    public static List<string>? Redeem(string candidate, string? hashesJson, IPasswordHasher hasher)
    {
        var normalized = Normalize(candidate);
        if (normalized.Length == 0)
            return null;

        var hashes = ReadHashes(hashesJson);
        var match = hashes.FirstOrDefault(h => hasher.Verify(normalized, h));
        if (match == null)
            return null;

        hashes.Remove(match);
        return hashes;
    }

    /// <summary>Uppercases and drops the display separator, so "abcde-fghij" and "ABCDEFGHIJ" match.</summary>
    private static string Normalize(string code)
        => new(code.Where(char.IsLetterOrDigit).Select(char.ToUpperInvariant).ToArray());
}
