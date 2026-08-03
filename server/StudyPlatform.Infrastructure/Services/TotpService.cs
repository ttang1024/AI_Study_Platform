using System.Security.Cryptography;
using System.Text;
using StudyPlatform.Application.Services;

namespace StudyPlatform.Infrastructure.Services;

/// <inheritdoc cref="ITotpService"/>
public class TotpService : ITotpService
{
    private const int StepSeconds = 30;
    private const int Digits = 6;

    /// <summary>
    /// How many steps either side of "now" still count.
    ///
    /// <para>One step — 30 seconds each way — is the usual compromise: it absorbs the phone clocks
    /// that drift by a few seconds and the user who types the code as the window turns over, without
    /// widening the window an observed code stays replayable in. Replay inside the window is closed
    /// separately, by the caller persisting the matched step.</para>
    /// </summary>
    private const int SkewSteps = 1;

    private const string Base32Alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

    public string GenerateSecret()
    {
        var bytes = RandomNumberGenerator.GetBytes(20);
        return ToBase32(bytes);
    }

    public string BuildProvisioningUri(string secretBase32, string issuer, string accountName)
    {
        var label = Uri.EscapeDataString($"{issuer}:{accountName}");
        var query = $"secret={secretBase32}"
                    + $"&issuer={Uri.EscapeDataString(issuer)}"
                    + $"&algorithm=SHA1&digits={Digits}&period={StepSeconds}";
        return $"otpauth://totp/{label}?{query}";
    }

    public long? Verify(string secretBase32, string code, long minimumStepExclusive = 0)
    {
        if (string.IsNullOrWhiteSpace(code))
            return null;

        // Authenticator apps display codes in a "123 456" grouping and users paste what they see.
        var normalized = new string(code.Where(char.IsDigit).ToArray());
        if (normalized.Length != Digits)
            return null;

        byte[] key;
        try
        {
            key = FromBase32(secretBase32);
        }
        catch (FormatException)
        {
            return null;
        }

        if (key.Length == 0)
            return null;

        var currentStep = DateTimeOffset.UtcNow.ToUnixTimeSeconds() / StepSeconds;

        for (var offset = -SkewSteps; offset <= SkewSteps; offset++)
        {
            var step = currentStep + offset;
            if (step <= minimumStepExclusive)
                continue;

            if (CryptographicOperations.FixedTimeEquals(
                    Encoding.ASCII.GetBytes(ComputeCode(key, step)),
                    Encoding.ASCII.GetBytes(normalized)))
            {
                return step;
            }
        }

        return null;
    }

    /// <summary>
    /// The code for one step. Internal so tests can pin RFC 6238's published vectors — the only
    /// check that proves interoperability with real authenticator apps rather than self-consistency.
    /// </summary>
    internal static string ComputeCode(byte[] key, long step)
    {
        var counter = BitConverter.GetBytes(step);
        if (BitConverter.IsLittleEndian)
            Array.Reverse(counter);

        var hash = HMACSHA1.HashData(key, counter);

        // Dynamic truncation, RFC 4226 §5.4: the low nibble of the last byte picks the 4-byte window.
        var offset = hash[^1] & 0x0F;
        var binary = ((hash[offset] & 0x7F) << 24)
                     | ((hash[offset + 1] & 0xFF) << 16)
                     | ((hash[offset + 2] & 0xFF) << 8)
                     | (hash[offset + 3] & 0xFF);

        return (binary % (int)Math.Pow(10, Digits)).ToString().PadLeft(Digits, '0');
    }

    internal static string ToBase32(byte[] data)
    {
        var builder = new StringBuilder((data.Length * 8 + 4) / 5);
        int buffer = 0, bitsLeft = 0;

        foreach (var b in data)
        {
            buffer = (buffer << 8) | b;
            bitsLeft += 8;
            while (bitsLeft >= 5)
            {
                builder.Append(Base32Alphabet[(buffer >> (bitsLeft - 5)) & 0x1F]);
                bitsLeft -= 5;
            }
        }

        if (bitsLeft > 0)
            builder.Append(Base32Alphabet[(buffer << (5 - bitsLeft)) & 0x1F]);

        return builder.ToString();
    }

    internal static byte[] FromBase32(string value)
    {
        if (string.IsNullOrWhiteSpace(value))
            return Array.Empty<byte>();

        // Padding is optional in otpauth secrets and case is not significant.
        var cleaned = value.Trim().TrimEnd('=').Replace(" ", string.Empty).ToUpperInvariant();

        var output = new List<byte>(cleaned.Length * 5 / 8);
        int buffer = 0, bitsLeft = 0;

        foreach (var c in cleaned)
        {
            var index = Base32Alphabet.IndexOf(c);
            if (index < 0)
                throw new FormatException($"'{c}' is not a base32 character.");

            buffer = (buffer << 5) | index;
            bitsLeft += 5;
            if (bitsLeft >= 8)
            {
                output.Add((byte)((buffer >> (bitsLeft - 8)) & 0xFF));
                bitsLeft -= 8;
            }
        }

        return output.ToArray();
    }
}
