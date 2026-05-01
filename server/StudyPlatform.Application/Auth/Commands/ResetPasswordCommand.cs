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
        var user = await _unitOfWork.Users.GetByEmailAsync(request.Email.ToLowerInvariant(), cancellationToken);
        if (user == null)
            return Result.Failure("No account found with this email.", "USER_NOT_FOUND");

        var otp = await _unitOfWork.Otps.GetValidOtpAsync(request.Email, request.OtpCode, OtpPurpose.PasswordReset, cancellationToken);
        if (otp == null)
            return Result.Failure("Invalid or expired OTP code.", "INVALID_OTP");

        user.PasswordHash = _passwordHasher.Hash(request.NewPassword);
        user.UpdatedAt = DateTime.UtcNow;
        otp.IsUsed = true;

        _unitOfWork.Users.Update(user);
        _unitOfWork.Otps.Update(otp);

        await _unitOfWork.RefreshTokens.RevokeAllUserTokensAsync(user.UserId, cancellationToken);
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        return Result.Success("Password reset successfully.");
    }
}
