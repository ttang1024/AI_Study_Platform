using MediatR;
using StudyPlatform.Application.Auth.DTOs;
using StudyPlatform.Application.Common;
using StudyPlatform.Application.Security;
using StudyPlatform.Application.Services;
using StudyPlatform.Domain.Interfaces;

namespace StudyPlatform.Application.Auth.Commands;

public record LoginCommand(string Email, string Password) : IRequest<Result<AuthResponse>>;

public class LoginCommandHandler : IRequestHandler<LoginCommand, Result<AuthResponse>>
{
    private readonly IUserRepository _users;
    private readonly IPasswordHasher _passwordHasher;
    private readonly IAuthSessionIssuer _sessionIssuer;
    private readonly ILoginThrottle _throttle;

    public LoginCommandHandler(
        IUserRepository users,
        IPasswordHasher passwordHasher,
        IAuthSessionIssuer sessionIssuer,
        ILoginThrottle throttle)
    {
        _users = users;
        _passwordHasher = passwordHasher;
        _sessionIssuer = sessionIssuer;
        _throttle = throttle;
    }

    public async Task<Result<AuthResponse>> Handle(LoginCommand request, CancellationToken cancellationToken)
    {
        // Checked and counted for unknown emails too, so a lockout says nothing about whether the
        // address is registered.
        if (await _throttle.IsLockedOutAsync(request.Email, cancellationToken))
            return Result<AuthResponse>.Failure(LoginThrottleMessages.LockedOut, LoginThrottleMessages.ErrorCode);

        var user = await _users.GetByEmailAsync(request.Email.ToLowerInvariant(), cancellationToken);
        if (!PasswordCheck.Matches(_passwordHasher, user, request.Password))
        {
            await _throttle.RecordFailureAsync(request.Email, cancellationToken);
            return Result<AuthResponse>.Failure("Invalid email or password.", "INVALID_CREDENTIALS");
        }

        await _throttle.ResetAsync(request.Email, cancellationToken);

        if (!user!.IsEmailVerified)
            return Result<AuthResponse>.Failure("Email not verified.", "EMAIL_NOT_VERIFIED");

        PendingDeletion.CancelOnSignIn(user);

        if (!user.IsActive)
            return Result<AuthResponse>.Failure("Your account has been deactivated. Please contact support.", "ACCOUNT_DEACTIVATED");

        var response = await _sessionIssuer.IssueAsync(user!, cancellationToken: cancellationToken);
        return Result<AuthResponse>.Success(response, "Login successful.");
    }
}
