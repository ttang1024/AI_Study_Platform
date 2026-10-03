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
        var purpose = request.Purpose.ToLowerInvariant() == "registration"
            ? OtpPurpose.Registration
            : OtpPurpose.PasswordReset;

        if (purpose == OtpPurpose.Registration)
        {
            var userExists = await _unitOfWork.Users.EmailExistsAsync(request.Email, cancellationToken);
            if (userExists)
                return Result.Failure("Email is already registered.", "EMAIL_ALREADY_EXISTS");
        }
        else
        {
            var user = await _unitOfWork.Users.GetByEmailAsync(request.Email, cancellationToken);
            if (user == null)
                return Result.Failure("No account found with this email.", "USER_NOT_FOUND");
        }

        await _unitOfWork.Otps.InvalidateExistingOtpsAsync(request.Email, purpose, cancellationToken);

        var code = GenerateOtpCode();
        var otp = new OtpCode
        {
            OtpId = Guid.NewGuid(),
            UserId = null,
            Email = request.Email,
            Code = code,
            Purpose = purpose,
            IsUsed = false,
            ExpiresAt = DateTime.UtcNow.AddMinutes(10),
            CreatedAt = DateTime.UtcNow
        };

        if (purpose == OtpPurpose.PasswordReset)
        {
            var user = await _unitOfWork.Users.GetByEmailAsync(request.Email, cancellationToken);
            otp.UserId = user!.UserId;
        }

        await _unitOfWork.Otps.AddAsync(otp, cancellationToken);
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        var purposeText = purpose == OtpPurpose.Registration ? "Registration" : "Password Reset";
        try
        {
            await _emailService.SendOtpEmailAsync(request.Email, request.Email, code, purposeText, cancellationToken);
        }
        catch
        {
            return Result.Failure("Failed to send verification email. Please try again later.", "EMAIL_SEND_FAILED");
        }

        return Result.Success("OTP sent successfully.");
    }

    private static string GenerateOtpCode()
    {
        var random = new Random();
        return random.Next(100000, 999999).ToString();
    }
}
