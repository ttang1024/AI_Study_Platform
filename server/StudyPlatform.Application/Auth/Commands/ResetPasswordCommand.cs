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
    private readonly IUserRepository _users;
    private readonly IOtpRepository _otps;
    private readonly IRefreshTokenRepository _refreshTokens;
    private readonly IPasswordHasher _passwordHasher;

    public ResetPasswordCommandHandler(IUnitOfWork unitOfWork, IUserRepository users, IOtpRepository otps, IRefreshTokenRepository refreshTokens, IPasswordHasher passwordHasher)
    {
        _unitOfWork = unitOfWork;
        _users = users;
        _otps = otps;
        _refreshTokens = refreshTokens;
        _passwordHasher = passwordHasher;
    }

    public async Task<Result> Handle(ResetPasswordCommand request, CancellationToken cancellationToken)
    {
        var email = OtpVerifier.NormalizeEmail(request.Email);
        var user = await _users.GetByEmailAsync(email, cancellationToken);
        if (user == null) // same answer as a wrong code: this endpoint must not reveal which emails exist
            return Result.Failure("Invalid or expired OTP code.", "INVALID_OTP");

        var otp = await _otps.GetActiveOtpAsync(email, OtpPurpose.PasswordReset, cancellationToken);
        if (!await OtpVerifier.TryConsumeAsync(_otps, otp, request.OtpCode, cancellationToken))
            return Result.Failure("Invalid or expired OTP code.", "INVALID_OTP");

        user.PasswordHash = _passwordHasher.Hash(request.NewPassword);
        user.UpdatedAt = DateTime.UtcNow;
        _users.Update(user);

        await _refreshTokens.RevokeAllUserTokensAsync(user.UserId, cancellationToken);
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        return Result.Success("Password reset successfully.");
    }
}
