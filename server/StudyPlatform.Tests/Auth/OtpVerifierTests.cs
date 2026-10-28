using Moq;
using StudyPlatform.Application.Auth;
using StudyPlatform.Domain.Entities;
using StudyPlatform.Domain.Enums;
using StudyPlatform.Domain.Interfaces;
using StudyPlatform.Tests.TestSupport;
using Xunit;

namespace StudyPlatform.Tests.Auth;

public class OtpVerifierTests
{
    private static OtpCode Active() => new()
    {
        OtpId = Guid.NewGuid(), Email = "a@b.c", Code = "123456",
        Purpose = OtpPurpose.PasswordReset, ExpiresAt = DateTime.UtcNow.AddMinutes(10),
    };

    private static IOtpRepository Store(OtpCode otp) => new Mock<IOtpRepository>().WithAtomicOps(otp).Object;

    [Fact]
    public async Task CorrectCode_IsConsumed()
    {
        var otp = Active();
        var store = Store(otp);

        Assert.True(await OtpVerifier.TryConsumeAsync(store, otp, " 123456 "));
        Assert.True(otp.IsUsed);
        Assert.False(await OtpVerifier.TryConsumeAsync(store, otp, "123456")); // single use
    }

    [Fact]
    public async Task WrongCode_IsCounted()
    {
        var otp = Active();

        Assert.False(await OtpVerifier.TryConsumeAsync(Store(otp), otp, "000000"));
        Assert.Equal(1, otp.FailedAttempts);
        Assert.False(otp.IsUsed);
    }

    [Fact]
    public async Task AfterMaxWrongGuesses_EvenTheRightCodeFails()
    {
        var otp = Active();
        var store = Store(otp);
        for (var i = 0; i < OtpVerifier.MaxFailedAttempts; i++)
            Assert.False(await OtpVerifier.TryConsumeAsync(store, otp, "000000"));

        Assert.False(await OtpVerifier.TryConsumeAsync(store, otp, "123456"));
    }

    [Fact]
    public async Task TheGuessIsCountedBeforeItIsCompared()
    {
        // Counting first is what makes the cap hold under concurrency: a guess that cannot claim an
        // attempt is never compared at all.
        var otp = Active();
        var store = new Mock<IOtpRepository>();
        store.Setup(r => r.TryCountAttemptAsync(otp.OtpId, OtpVerifier.MaxFailedAttempts, default)).ReturnsAsync(false);

        Assert.False(await OtpVerifier.TryConsumeAsync(store.Object, otp, "123456"));
        store.Verify(r => r.TryMarkUsedAsync(It.IsAny<Guid>(), default), Times.Never);
    }

    [Fact]
    public async Task MissingOtp_Fails() => Assert.False(await OtpVerifier.TryConsumeAsync(Mock.Of<IOtpRepository>(), null, "123456"));

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
