using StudyPlatform.Application.Share.Commands;
using StudyPlatform.Application.Share.DTOs;
using Xunit;

namespace StudyPlatform.Tests.Share;

public class CreateShareCommandValidatorTests
{
    private readonly CreateShareCommandValidator _validator = new();

    private static CreateShareCommand Command(int? expiresInDays = null, string title = "T", string? mindMap = null)
        => new(Guid.NewGuid(), new CreateShareRequest(title, null, mindMap, null, null, null, null, expiresInDays, null, null));

    [Theory]
    [InlineData(null)]
    [InlineData(1)]
    [InlineData(CreateShareCommandValidator.MaxExpiryDays)]
    public void SensibleExpiry_IsValid(int? days) => Assert.True(_validator.Validate(Command(days)).IsValid);

    [Theory]
    [InlineData(0)]
    [InlineData(-5)] // a share born expired
    [InlineData(int.MaxValue)] // DateTime.AddDays overflowed into a 500
    public void OutOfRangeExpiry_IsRejected(int days) => Assert.False(_validator.Validate(Command(days)).IsValid);

    [Fact]
    public void MissingTitle_IsRejected() => Assert.False(_validator.Validate(Command(title: "")).IsValid);

    [Fact]
    public void OversizedField_IsRejected()
        => Assert.False(_validator.Validate(Command(mindMap: new string('x', CreateShareCommandValidator.MaxTextLength + 1))).IsValid);
}
