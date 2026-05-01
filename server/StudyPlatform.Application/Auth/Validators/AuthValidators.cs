using FluentValidation;
using StudyPlatform.Application.Auth.Commands;

namespace StudyPlatform.Application.Auth.Validators;

internal static class PasswordPolicy
{
    private const int MinimumLength = 8;
    private const int MaximumLength = 20;

    public const string Message = "Password must be 8-20 characters and contain at least 3 of: uppercase letters, lowercase letters, numbers, symbols.";

    public static bool IsValid(string password)
    {
        if (string.IsNullOrEmpty(password) || password.Length < MinimumLength || password.Length > MaximumLength)
            return false;

        var categories = 0;
        if (password.Any(char.IsUpper)) categories++;
        if (password.Any(char.IsLower)) categories++;
        if (password.Any(char.IsDigit)) categories++;
        if (password.Any(c => !char.IsLetterOrDigit(c))) categories++;

        return categories >= 3;
    }
}

public class SendEmailOtpValidator : AbstractValidator<SendEmailOtpCommand>
{
    public SendEmailOtpValidator()
    {
        RuleFor(x => x.Email)
            .NotEmpty().WithMessage("Email is required.")
            .EmailAddress().WithMessage("Invalid email address.");

        RuleFor(x => x.Purpose)
            .NotEmpty().WithMessage("Purpose is required.")
            .Must(p => p == "registration" || p == "passwordReset")
            .WithMessage("Purpose must be 'registration' or 'passwordReset'.");
    }
}

public class RegisterValidator : AbstractValidator<RegisterCommand>
{
    public RegisterValidator()
    {
        RuleFor(x => x.Email)
            .NotEmpty().WithMessage("Email is required.")
            .EmailAddress().WithMessage("Invalid email address.");

        RuleFor(x => x.Password)
            .Cascade(CascadeMode.Stop)
            .NotEmpty().WithMessage("Password is required.")
            .Must(PasswordPolicy.IsValid).WithMessage(PasswordPolicy.Message);

        RuleFor(x => x.FullName)
            .NotEmpty().WithMessage("Full name is required.")
            .MinimumLength(2).WithMessage("Full name must be at least 2 characters.")
            .MaximumLength(100).WithMessage("Full name must not exceed 100 characters.");

        RuleFor(x => x.OtpCode)
            .NotEmpty().WithMessage("OTP code is required.")
            .Length(6).WithMessage("OTP code must be 6 digits.");
    }
}

public class LoginValidator : AbstractValidator<LoginCommand>
{
    public LoginValidator()
    {
        RuleFor(x => x.Email)
            .NotEmpty().WithMessage("Email is required.")
            .EmailAddress().WithMessage("Invalid email address.");

        RuleFor(x => x.Password)
            .NotEmpty().WithMessage("Password is required.");
    }
}

public class ResetPasswordValidator : AbstractValidator<ResetPasswordCommand>
{
    public ResetPasswordValidator()
    {
        RuleFor(x => x.Email)
            .NotEmpty().WithMessage("Email is required.")
            .EmailAddress().WithMessage("Invalid email address.");

        RuleFor(x => x.OtpCode)
            .NotEmpty().WithMessage("OTP code is required.")
            .Length(6).WithMessage("OTP code must be 6 digits.");

        RuleFor(x => x.NewPassword)
            .Cascade(CascadeMode.Stop)
            .NotEmpty().WithMessage("New password is required.")
            .Must(PasswordPolicy.IsValid).WithMessage(PasswordPolicy.Message);
    }
}

public class ChangePasswordValidator : AbstractValidator<ChangePasswordCommand>
{
    public ChangePasswordValidator()
    {
        RuleFor(x => x.CurrentPassword)
            .NotEmpty().WithMessage("Current password is required.");

        RuleFor(x => x.NewPassword)
            .Cascade(CascadeMode.Stop)
            .NotEmpty().WithMessage("New password is required.")
            .Must(PasswordPolicy.IsValid).WithMessage(PasswordPolicy.Message);
    }
}
