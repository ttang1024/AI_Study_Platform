namespace StudyPlatform.Application.Services;

public interface IEmailService
{
    Task SendOtpEmailAsync(string toEmail, string fullName, string otpCode, string purpose, CancellationToken cancellationToken = default);
    Task SendWelcomeEmailAsync(string toEmail, string fullName, CancellationToken cancellationToken = default);
}
