using MediatR;
using StudyPlatform.Application.Common;
using StudyPlatform.Domain.Enums;
using StudyPlatform.Domain.Interfaces;
using StudyPlatform.Domain.Entities;
using StudyPlatform.Application.Services;

namespace StudyPlatform.Application.Auth.Commands;

public record SendEmailOtpCommand(string Email, string Purpose) : IRequest<Result>;

public class SendEmailOtpCommandHandler : IRequestHandler<SendEmailOtpCommand, Result>
{
    private readonly IUnitOfWork _unitOfWork;
    private readonly IEmailService _emailService;

    public SendEmailOtpCommandHandler(IUnitOfWork unitOfWork, IEmailService emailService)
    {
        _unitOfWork = unitOfWork;
        _emailService = emailService;
    }

    public async Task<Result> Handle(SendEmailOtpCommand request, CancellationToken cancellationToken)
    {
        var email = OtpVerifier.NormalizeEmail(request.Email);
        var purpose = request.Purpose.ToLowerInvariant() == "registration"
            ? OtpPurpose.Registration
            : OtpPurpose.PasswordReset;

        // Answers the same whether or not the address has an account — otherwise this endpoint tells
        // anyone which emails are registered here. The account holder still learns what happened.
        var user = await _unitOfWork.Users.GetByEmailAsync(email, cancellationToken);
        if (purpose == OtpPurpose.Registration && user != null)
        {
            try { await _emailService.SendAccountExistsEmailAsync(email, cancellationToken); }
            catch { /* a send failure must not answer differently from the success path */ }
            return Result.Success(SentMessage);
        }
        if (purpose == OtpPurpose.PasswordReset && user == null)
            return Result.Success(SentMessage);

        await _unitOfWork.Otps.InvalidateExistingOtpsAsync(email, purpose, cancellationToken);

        var code = OtpVerifier.GenerateCode();
        var otp = new OtpCode
        {
            OtpId = Guid.NewGuid(),
            UserId = null,
            Email = email,
            Code = code,
            Purpose = purpose,
            IsUsed = false,
            ExpiresAt = DateTime.UtcNow.AddMinutes(10),
            CreatedAt = DateTime.UtcNow
        };

        if (purpose == OtpPurpose.PasswordReset)
            otp.UserId = user!.UserId;

        await _unitOfWork.Otps.AddAsync(otp, cancellationToken);
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        var purposeText = purpose == OtpPurpose.Registration ? "Registration" : "Password Reset";
        try
        {
            await _emailService.SendOtpEmailAsync(email, email, code, purposeText, cancellationToken);
        }
        catch
        {
            return Result.Failure("Failed to send verification email. Please try again later.", "EMAIL_SEND_FAILED");
        }

        return Result.Success(SentMessage);
    }

    private const string SentMessage = "If this email can be used, a verification code has been sent to it.";
}
