using FluentValidation.TestHelper;
using StudyPlatform.Application.Auth.Commands;
using StudyPlatform.Application.Auth.Validators;
using Xunit;

namespace StudyPlatform.Tests.Validators;

public class LoginValidatorTests
{
    private readonly LoginValidator _validator = new();

    [Fact]
    public void Valid_LoginCommand_PassesValidation()
    {
        var result = _validator.TestValidate(new LoginCommand("user@example.com", "password"));
        result.ShouldNotHaveAnyValidationErrors();
    }

    [Theory]
    [InlineData("")]
    [InlineData("not-an-email")]
    public void Invalid_Email_FailsValidation(string email)
    {
        var result = _validator.TestValidate(new LoginCommand(email, "password"));
        result.ShouldHaveValidationErrorFor(x => x.Email);
    }

    [Fact]
    public void Empty_Password_FailsValidation()
    {
        var result = _validator.TestValidate(new LoginCommand("user@example.com", ""));
        result.ShouldHaveValidationErrorFor(x => x.Password);
    }
}

public class RegisterValidatorTests
{
    private readonly RegisterValidator _validator = new();

    private static RegisterCommand Valid() =>
        new("user@example.com", "Password1", "John Doe", "123456");

    [Fact]
    public void Valid_RegisterCommand_PassesValidation()
    {
        _validator.TestValidate(Valid()).ShouldNotHaveAnyValidationErrors();
    }

    [Fact]
    public void Password_WithLowercaseNumbersAndSymbols_PassesValidation()
    {
        _validator.TestValidate(Valid() with { Password = "..1991study" })
            .ShouldNotHaveValidationErrorFor(x => x.Password);
    }

    [Theory]
    [InlineData("")]
    [InlineData("notanemail")]
    public void Invalid_Email_FailsValidation(string email)
    {
        _validator.TestValidate(Valid() with { Email = email })
            .ShouldHaveValidationErrorFor(x => x.Email);
    }

    [Theory]
    [InlineData("short1!")]              // too short
    [InlineData("alllowercase1")]        // only lowercase + numbers
    [InlineData("NoDigitsHere")]         // only uppercase + lowercase
    [InlineData("ThisPasswordIsTooLong1!")] // too long
    public void Weak_Password_FailsValidation(string password)
    {
        _validator.TestValidate(Valid() with { Password = password })
            .ShouldHaveValidationErrorFor(x => x.Password);
    }

    [Theory]
    [InlineData("")]  // empty
    [InlineData("A")] // too short
    public void Invalid_FullName_FailsValidation(string name)
    {
        _validator.TestValidate(Valid() with { FullName = name })
            .ShouldHaveValidationErrorFor(x => x.FullName);
    }

    [Theory]
    [InlineData("")]      // empty
    [InlineData("12345")] // too short (5 digits)
    [InlineData("1234567")] // too long (7 digits)
    public void Invalid_OtpCode_FailsValidation(string otp)
    {
        _validator.TestValidate(Valid() with { OtpCode = otp })
            .ShouldHaveValidationErrorFor(x => x.OtpCode);
    }

    [Fact]
    public void FullName_Over100Chars_FailsValidation()
    {
        var longName = new string('A', 101);
        _validator.TestValidate(Valid() with { FullName = longName })
            .ShouldHaveValidationErrorFor(x => x.FullName);
    }
}

public class ResetPasswordValidatorTests
{
    private readonly ResetPasswordValidator _validator = new();

    private static ResetPasswordCommand Valid() =>
        new("user@example.com", "123456", "NewPass1");

    [Fact]
    public void Valid_Command_PassesValidation()
    {
        _validator.TestValidate(Valid()).ShouldNotHaveAnyValidationErrors();
    }

    [Fact]
    public void Invalid_Email_FailsValidation()
    {
        _validator.TestValidate(Valid() with { Email = "bad" })
            .ShouldHaveValidationErrorFor(x => x.Email);
    }

    [Fact]
    public void Otp_Not6Digits_FailsValidation()
    {
        _validator.TestValidate(Valid() with { OtpCode = "12345" })
            .ShouldHaveValidationErrorFor(x => x.OtpCode);
    }

    [Theory]
    [InlineData("short1!")]
    [InlineData("alllower1")]
    [InlineData("NoDigits")]
    [InlineData("ThisPasswordIsTooLong1!")]
    public void Weak_NewPassword_FailsValidation(string password)
    {
        _validator.TestValidate(Valid() with { NewPassword = password })
            .ShouldHaveValidationErrorFor(x => x.NewPassword);
    }
}

public class ChangePasswordValidatorTests
{
    private readonly ChangePasswordValidator _validator = new();

    private static ChangePasswordCommand Valid() =>
        new(Guid.NewGuid(), "OldPass1", "NewPass1");

    [Fact]
    public void Valid_Command_PassesValidation()
    {
        _validator.TestValidate(Valid()).ShouldNotHaveAnyValidationErrors();
    }

    [Fact]
    public void Empty_CurrentPassword_FailsValidation()
    {
        _validator.TestValidate(Valid() with { CurrentPassword = "" })
            .ShouldHaveValidationErrorFor(x => x.CurrentPassword);
    }

    [Theory]
    [InlineData("short1!")]
    [InlineData("alllower1")]
    [InlineData("NoDigits")]
    [InlineData("ThisPasswordIsTooLong1!")]
    public void Weak_NewPassword_FailsValidation(string password)
    {
        _validator.TestValidate(Valid() with { NewPassword = password })
            .ShouldHaveValidationErrorFor(x => x.NewPassword);
    }
}

public class SendEmailOtpValidatorTests
{
    private readonly SendEmailOtpValidator _validator = new();

    [Theory]
    [InlineData("registration")]
    [InlineData("passwordReset")]
    public void Valid_Purpose_PassesValidation(string purpose)
    {
        var result = _validator.TestValidate(new SendEmailOtpCommand("u@x.com", purpose));
        result.ShouldNotHaveAnyValidationErrors();
    }

    [Fact]
    public void Invalid_Purpose_FailsValidation()
    {
        _validator.TestValidate(new SendEmailOtpCommand("u@x.com", "unknown"))
            .ShouldHaveValidationErrorFor(x => x.Purpose);
    }

    [Fact]
    public void Invalid_Email_FailsValidation()
    {
        _validator.TestValidate(new SendEmailOtpCommand("notanemail", "registration"))
            .ShouldHaveValidationErrorFor(x => x.Email);
    }
}
