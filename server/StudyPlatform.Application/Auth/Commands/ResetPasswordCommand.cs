using MediatR;
using StudyPlatform.Application.Common;
using StudyPlatform.Application.Services;
using StudyPlatform.Domain.Enums;
using StudyPlatform.Domain.Interfaces;

namespace StudyPlatform.Application.Auth.Commands;

public record ResetPasswordCommand(
    string Email,
    string OtpCode,
    string NewPassword) : IRequest<Result>;

public class ResetPasswordCommandHandler : IRequestHandler<ResetPasswordCommand, Result>
{
    private readonly IUnitOfWork _unitOfWork;
    private readonly IPasswordHasher _passwordHasher;

    public ResetPasswordCommandHandler(IUnitOfWork unitOfWork, IPasswordHasher passwordHasher)
    {
        _unitOfWork = unitOfWork;
        _passwordHasher = passwordHasher;
    }

    public async Task<Result> Handle(ResetPasswordCommand request, CancellationToken cancellationToken)
    {
        var email = OtpVerifier.NormalizeEmail(request.Email);
        var user = await _unitOfWork.Users.GetByEmailAsync(email, cancellationToken);
        if (user == null) // same answer as a wrong code: this endpoint must not reveal which emails exist
            return Result.Failure("Invalid or expired OTP code.", "INVALID_OTP");

        var otp = await _unitOfWork.Otps.GetActiveOtpAsync(email, OtpPurpose.PasswordReset, cancellationToken);
        if (!OtpVerifier.TryConsume(otp, request.OtpCode))
        {
            if (otp != null)
                await _unitOfWork.SaveChangesAsync(cancellationToken); // persist the counted wrong guess
            return Result.Failure("Invalid or expired OTP code.", "INVALID_OTP");
        }

        user.PasswordHash = _passwordHasher.Hash(request.NewPassword);
        user.UpdatedAt = DateTime.UtcNow;
        _unitOfWork.Users.Update(user);
        _unitOfWork.Otps.Update(otp!);

        await _unitOfWork.RefreshTokens.RevokeAllUserTokensAsync(user.UserId, cancellationToken);
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        return Result.Success("Password reset successfully.");
    }
}
