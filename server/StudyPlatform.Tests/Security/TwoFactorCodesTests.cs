using Moq;
using StudyPlatform.Application.Security;
using StudyPlatform.Application.Services;
using Xunit;

namespace StudyPlatform.Tests.Security;

public class TwoFactorCodesTests
{
    /// <summary>
    /// A stand-in hasher that is reversible on purpose, so the tests exercise redemption logic
    /// rather than spending BCrypt work factors on every comparison.
    /// </summary>
    private static Mock<IPasswordHasher> FakeHasher()
    {
        var hasher = new Mock<IPasswordHasher>();
        hasher.Setup(h => h.Hash(It.IsAny<string>())).Returns((string s) => $"hash:{s}");
        hasher.Setup(h => h.Verify(It.IsAny<string>(), It.IsAny<string>()))
            .Returns((string plain, string hash) => hash == $"hash:{plain}");
        return hasher;
    }

    [Fact]
    public void Generate_ProducesTheExpectedNumberOfDistinctCodes()
    {
        var codes = TwoFactorCodes.Generate();

        Assert.Equal(TwoFactorCodes.CodeCount, codes.Count);
        Assert.Equal(TwoFactorCodes.CodeCount, codes.Distinct().Count());
    }

    [Fact]
    public void HashAll_StoresHashesAndNeverThePlaintext()
    {
        var hasher = FakeHasher();
        var codes = TwoFactorCodes.Generate();

        var json = TwoFactorCodes.HashAll(codes, hasher.Object);

        Assert.Equal(TwoFactorCodes.CodeCount, TwoFactorCodes.ReadHashes(json).Count);
        foreach (var code in codes)
            Assert.DoesNotContain(code, json);
    }

    [Fact]
    public void Redeem_AcceptsAValidCodeAndRemovesIt()
    {
        var hasher = FakeHasher();
        var codes = TwoFactorCodes.Generate();
        var json = TwoFactorCodes.HashAll(codes, hasher.Object);

        var remaining = TwoFactorCodes.Redeem(codes[3], json, hasher.Object);

        Assert.NotNull(remaining);
        Assert.Equal(TwoFactorCodes.CodeCount - 1, remaining!.Count);
    }

    /// <summary>A recovery code is a full bypass of the second factor, so spending it must be final.</summary>
    [Fact]
    public void Redeem_RefusesTheSameCodeTwice()
    {
        var hasher = FakeHasher();
        var codes = TwoFactorCodes.Generate();
        var json = TwoFactorCodes.HashAll(codes, hasher.Object);

        var afterFirst = TwoFactorCodes.Redeem(codes[0], json, hasher.Object);
        Assert.NotNull(afterFirst);

        var afterSecond = TwoFactorCodes.Redeem(codes[0], TwoFactorCodes.WriteHashes(afterFirst!), hasher.Object);
        Assert.Null(afterSecond);
    }

    [Fact]
    public void Redeem_IgnoresCaseAndSeparators()
    {
        var hasher = FakeHasher();
        var codes = TwoFactorCodes.Generate();
        var json = TwoFactorCodes.HashAll(codes, hasher.Object);

        // Users retype these from paper; the display grouping and casing should not matter.
        var typed = codes[0].ToLowerInvariant().Replace("-", " ");

        Assert.NotNull(TwoFactorCodes.Redeem(typed, json, hasher.Object));
    }

    [Fact]
    public void Redeem_RejectsAnUnknownCode()
    {
        var hasher = FakeHasher();
        var json = TwoFactorCodes.HashAll(TwoFactorCodes.Generate(), hasher.Object);

        Assert.Null(TwoFactorCodes.Redeem("ZZZZZ-ZZZZZ", json, hasher.Object));
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("not json")]
    public void ReadHashes_TreatsUnreadableStorageAsEmpty(string? json)
    {
        // Failing closed matters more than failing loudly here: an unreadable blob must mean
        // "no recovery codes work", never an exception thrown out of the login path.
        Assert.Empty(TwoFactorCodes.ReadHashes(json));
    }
}
