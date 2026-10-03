using Amazon;
using Amazon.SimpleEmailV2;
using Amazon.SimpleEmailV2.Model;
using MailKit.Net.Smtp;
using MailKit.Security;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using MimeKit;
using StudyPlatform.Application.Services;

namespace StudyPlatform.Infrastructure.Services;

public class EmailService : IEmailService
{
    private readonly IConfiguration _configuration;
    private readonly ILogger<EmailService> _logger;

    public EmailService(IConfiguration configuration, ILogger<EmailService> logger)
    {
        _configuration = configuration;
        _logger = logger;
    }

    public async Task SendOtpEmailAsync(string toEmail, string fullName, string otpCode, string purpose, CancellationToken cancellationToken = default)
    {
        var subject = purpose == "Registration"
            ? "Your StudyPlatform Verification Code"
            : "Your StudyPlatform Password Reset Code";

        var body = $@"
<!DOCTYPE html>
<html>
<head><meta charset=""utf-8""></head>
<body style=""font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;"">
    <div style=""background: linear-gradient(135deg, #059669 0%, #14b8a6 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;"">
        <h1 style=""color: white; margin: 0;"">StudyPlatform</h1>
    </div>
    <div style=""background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; border: 1px solid #ddd;"">
        <h2 style=""color: #333;"">Hello!</h2>
        <p style=""color: #666;"">Your {purpose} verification code is:</p>
        <div style=""background: #fff; border: 2px solid #059669; border-radius: 8px; padding: 20px; text-align: center; margin: 20px 0;"">
            <span style=""font-size: 36px; font-weight: bold; color: #059669; letter-spacing: 8px;"">{otpCode}</span>
        </div>
        <p style=""color: #666;"">This code expires in <strong>10 minutes</strong>.</p>
        <p style=""color: #999; font-size: 12px;"">If you did not request this code, please ignore this email.</p>
    </div>
</body>
</html>";

        await SendEmailAsync(toEmail, subject, body, cancellationToken);
    }

    public async Task SendWelcomeEmailAsync(string toEmail, string fullName, CancellationToken cancellationToken = default)
    {
        var subject = "Welcome to StudyPlatform!";
        var body = $@"
<!DOCTYPE html>
<html>
<head><meta charset=""utf-8""></head>
<body style=""font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;"">
    <div style=""background: linear-gradient(135deg, #059669 0%, #14b8a6 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;"">
        <h1 style=""color: white; margin: 0;"">Welcome to StudyPlatform!</h1>
    </div>
    <div style=""background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; border: 1px solid #ddd;"">
        <h2 style=""color: #333;"">Hello, {fullName}!</h2>
        <p style=""color: #666;"">Your account has been successfully created. You can now start your AI-powered learning journey!</p>
        <ul style=""color: #666;"">
            <li>Upload documents and get AI-generated summaries</li>
            <li>Generate quizzes and flashcards automatically</li>
            <li>Chat with AI about your documents</li>
            <li>Track your study progress</li>
        </ul>
        <p style=""color: #666;"">Happy studying!</p>
    </div>
</body>
</html>";

        await SendEmailAsync(toEmail, subject, body, cancellationToken);
    }

    private async Task SendEmailAsync(string toEmail, string subject, string htmlBody, CancellationToken cancellationToken)
    {
        try
        {
            var emailSettings = _configuration.GetSection("EmailSettings");
            var provider = emailSettings["Provider"] ?? "Smtp";

            if (provider.Equals("Ses", StringComparison.OrdinalIgnoreCase)
                || provider.Equals("AwsSes", StringComparison.OrdinalIgnoreCase))
            {
                await SendEmailWithSesAsync(emailSettings, toEmail, subject, htmlBody, cancellationToken);
                return;
            }

            await SendEmailWithSmtpAsync(emailSettings, toEmail, subject, htmlBody, cancellationToken);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to send email to {Email}", toEmail);
            throw new InvalidOperationException("Failed to send email.", ex);
        }
    }

    private async Task SendEmailWithSesAsync(IConfigurationSection emailSettings, string toEmail, string subject, string htmlBody, CancellationToken cancellationToken)
    {
        var fromEmail = emailSettings["FromEmail"] ?? "noreply@studyplatform.com";
        var fromName = emailSettings["FromName"] ?? "StudyPlatform";
        var regionName = emailSettings["SesRegion"]
            ?? _configuration["AWS:Region"]
            ?? _configuration["AWS_REGION"]
            ?? "ap-southeast-2";

        using var client = new AmazonSimpleEmailServiceV2Client(RegionEndpoint.GetBySystemName(regionName));
        await client.SendEmailAsync(new SendEmailRequest
        {
            FromEmailAddress = $"{fromName} <{fromEmail}>",
            Destination = new Destination
            {
                ToAddresses = new List<string> { toEmail }
            },
            Content = new EmailContent
            {
                Simple = new Message
                {
                    Subject = new Content
                    {
                        Charset = "UTF-8",
                        Data = subject
                    },
                    Body = new Body
                    {
                        Html = new Content
                        {
                            Charset = "UTF-8",
                            Data = htmlBody
                        }
                    }
                }
            }
        }, cancellationToken);
    }

    private async Task SendEmailWithSmtpAsync(IConfigurationSection emailSettings, string toEmail, string subject, string htmlBody, CancellationToken cancellationToken)
    {
        var fromEmail = emailSettings["FromEmail"] ?? "noreply@studyplatform.com";
        var fromName = emailSettings["FromName"] ?? "StudyPlatform";
        var smtpHost = emailSettings["SmtpHost"] ?? "smtp.gmail.com";
        var smtpPort = int.Parse(emailSettings["SmtpPort"] ?? "587");
        var smtpUser = emailSettings["SmtpUser"] ?? string.Empty;
        var smtpPassword = emailSettings["SmtpPassword"] ?? string.Empty;

        var message = new MimeMessage();
        message.From.Add(new MailboxAddress(fromName, fromEmail));
        message.To.Add(MailboxAddress.Parse(toEmail));
        message.Subject = subject;

        var bodyBuilder = new BodyBuilder { HtmlBody = htmlBody };
        message.Body = bodyBuilder.ToMessageBody();

        using var client = new SmtpClient();
        await client.ConnectAsync(smtpHost, smtpPort, SecureSocketOptions.StartTls, cancellationToken);
        await client.AuthenticateAsync(smtpUser, smtpPassword, cancellationToken);
        await client.SendAsync(message, cancellationToken);
        await client.DisconnectAsync(true, cancellationToken);
    }
}
