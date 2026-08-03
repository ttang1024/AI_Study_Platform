using StudyPlatform.Infrastructure.Services;
using Xunit;

namespace StudyPlatform.Tests.Security;

public class TotpServiceTests
{
    private readonly TotpService _totp = new();

    [Fact]
    public void GenerateSecret_ProducesDecodableBase32()
    {
        var secret = _totp.GenerateSecret();

        // 160 bits is what RFC 4226 recommends for HMAC-SHA1, and it is what authenticator apps expect.
        Assert.Equal(20, TotpService.FromBase32(secret).Length);
    }

    [Fact]
    public void Base32_RoundTrips()
    {
        var bytes = new byte[] { 0x00, 0x01, 0x7F, 0x80, 0xFF, 0x2A, 0x9C };

        Assert.Equal(bytes, TotpService.FromBase32(TotpService.ToBase32(bytes)));
    }

    /// <summary>
    /// RFC 6238's published test vector. Pinning it is the only way to know the implementation is
    /// interoperable rather than merely self-consistent — a code that only matches our own generator
    /// would pass every round-trip test and still be rejected by every real authenticator app.
    /// </summary>
    [Theory]
    [InlineData(59L, "287082")]
    [InlineData(1111111109L, "081804")]
    [InlineData(1234567890L, "005924")]
    [InlineData(2000000000L, "279037")]
    public void Verify_MatchesRfc6238TestVectors(long unixTime, string expectedCode)
    {
        // The RFC's SHA-1 seed is the ASCII "12345678901234567890".
        var key = "12345678901234567890"u8.ToArray();

        Assert.Equal(expectedCode, TotpService.ComputeCode(key, unixTime / 30));
    }

    [Fact]
    public void Verify_AcceptsCurrentCode()
    {
        var secret = _totp.GenerateSecret();
        var step = DateTimeOffset.UtcNow.ToUnixTimeSeconds() / 30;

        Assert.Equal(step, _totp.Verify(secret, ComputeAt(secret, step)));
    }

    [Fact]
    public void Verify_AcceptsSpacedAndPaddedInput()
    {
        var secret = _totp.GenerateSecret();
        var step = DateTimeOffset.UtcNow.ToUnixTimeSeconds() / 30;
        var code = ComputeAt(secret, step);

        // Authenticator apps display "123 456" and users paste exactly that.
        Assert.NotNull(_totp.Verify(secret, $" {code[..3]} {code[3..]} "));
    }

    [Fact]
    public void Verify_AcceptsOneStepOfSkew()
    {
        var secret = _totp.GenerateSecret();
        var step = DateTimeOffset.UtcNow.ToUnixTimeSeconds() / 30;

        Assert.NotNull(_totp.Verify(secret, ComputeAt(secret, step - 1)));
        Assert.NotNull(_totp.Verify(secret, ComputeAt(secret, step + 1)));
    }

    [Fact]
    public void Verify_RejectsCodeBeyondSkewWindow()
    {
        var secret = _totp.GenerateSecret();
        var step = DateTimeOffset.UtcNow.ToUnixTimeSeconds() / 30;

        Assert.Null(_totp.Verify(secret, ComputeAt(secret, step - 5)));
        Assert.Null(_totp.Verify(secret, ComputeAt(secret, step + 5)));
    }

    /// <summary>
    /// The replay guard. A code stays valid for its whole 30-second step, so without rejecting steps
    /// at or below the last accepted one, an observed code could be reused until the window turned over.
    /// </summary>
    [Fact]
    public void Verify_RejectsAlreadyUsedStep()
    {
        var secret = _totp.GenerateSecret();
        var step = DateTimeOffset.UtcNow.ToUnixTimeSeconds() / 30;
        var code = ComputeAt(secret, step);

        var accepted = _totp.Verify(secret, code);
        Assert.Equal(step, accepted);

        Assert.Null(_totp.Verify(secret, code, minimumStepExclusive: accepted!.Value));
    }

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    [InlineData("12345")]
    [InlineData("1234567")]
    [InlineData("abcdef")]
    public void Verify_RejectsMalformedCodes(string code)
    {
        Assert.Null(_totp.Verify(_totp.GenerateSecret(), code));
    }

    [Fact]
    public void Verify_RejectsWhenSecretIsNotBase32()
    {
        // A corrupt secret must fail closed rather than throw out of the login path.
        Assert.Null(_totp.Verify("not-valid-base32!!", "123456"));
    }

    [Fact]
    public void BuildProvisioningUri_CarriesTheParametersAuthenticatorAppsRead()
    {
        var uri = _totp.BuildProvisioningUri("JBSWY3DPEHPK3PXP", "StudyPlatform", "user@example.com");

        Assert.StartsWith("otpauth://totp/", uri);
        Assert.Contains("secret=JBSWY3DPEHPK3PXP", uri);
        Assert.Contains("issuer=StudyPlatform", uri);
        Assert.Contains("algorithm=SHA1", uri);
        Assert.Contains("digits=6", uri);
        Assert.Contains("period=30", uri);
        // The colon in the label has to be escaped or apps read the account name as a second segment.
        Assert.Contains("StudyPlatform%3Auser%40example.com", uri);
    }

    private static string ComputeAt(string secret, long step)
        => TotpService.ComputeCode(TotpService.FromBase32(secret), step);
}
