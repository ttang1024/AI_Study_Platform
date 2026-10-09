namespace StudyPlatform.Application.Services;

public interface IEmailService
{
    Task SendOtpEmailAsync(string toEmail, string fullName, string otpCode, string purpose, CancellationToken cancellationToken = default);
    Task SendWelcomeEmailAsync(string toEmail, string fullName, CancellationToken cancellationToken = default);

    /// <summary>
    /// Sent instead of a registration code when the address already has an account, so the sign-up
    /// form can answer identically either way without leaving the real owner uninformed.
    /// </summary>
    Task SendAccountExistsEmailAsync(string toEmail, CancellationToken cancellationToken = default);
}
