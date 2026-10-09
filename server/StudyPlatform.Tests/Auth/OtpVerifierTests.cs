using StudyPlatform.Application.Auth;
using StudyPlatform.Domain.Entities;
using StudyPlatform.Domain.Enums;
using Xunit;

namespace StudyPlatform.Tests.Auth;

public class OtpVerifierTests
{
    private static OtpCode Active() => new()
    {
        OtpId = Guid.NewGuid(), Email = "a@b.c", Code = "123456",
        Purpose = OtpPurpose.PasswordReset, ExpiresAt = DateTime.UtcNow.AddMinutes(10),
    };

    [Fact]
    public void CorrectCode_IsConsumed()
    {
        var otp = Active();

        Assert.True(OtpVerifier.TryConsume(otp, " 123456 "));
        Assert.True(otp.IsUsed);
        Assert.False(OtpVerifier.TryConsume(otp, "123456")); // single use
    }

    [Fact]
    public void WrongCode_IsCounted()
    {
        var otp = Active();

        Assert.False(OtpVerifier.TryConsume(otp, "000000"));
        Assert.Equal(1, otp.FailedAttempts);
        Assert.False(otp.IsUsed);
    }

    [Fact]
    public void AfterMaxWrongGuesses_EvenTheRightCodeFails()
    {
        var otp = Active();
        for (var i = 0; i < OtpVerifier.MaxFailedAttempts; i++)
            Assert.False(OtpVerifier.TryConsume(otp, "000000"));

        Assert.True(otp.IsUsed);
        Assert.False(OtpVerifier.TryConsume(otp, "123456"));
    }

    [Fact]
    public void MissingOtp_Fails() => Assert.False(OtpVerifier.TryConsume(null, "123456"));

    [Fact]
    public void GeneratedCodes_AreSixDigits()
    {
        for (var i = 0; i < 200; i++)
            Assert.Matches("^[1-9][0-9]{5}$", OtpVerifier.GenerateCode());
    }

    [Fact]
    public void NormalizeEmail_TrimsAndLowercases()
        => Assert.Equal("user@example.com", OtpVerifier.NormalizeEmail("  User@Example.COM "));
}
