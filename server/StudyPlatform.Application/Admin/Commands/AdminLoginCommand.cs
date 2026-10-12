using MediatR;
using StudyPlatform.Application.Admin.DTOs;
using StudyPlatform.Application.Auth;
using StudyPlatform.Application.Common;
using StudyPlatform.Application.Services;
using StudyPlatform.Domain.Interfaces;

namespace StudyPlatform.Application.Admin.Commands;

public record AdminLoginCommand(string Email, string Password) : IRequest<Result<AdminTokenResponse>>;

public class AdminLoginCommandHandler : IRequestHandler<AdminLoginCommand, Result<AdminTokenResponse>>
{
    private readonly IUserRepository _users;
    private readonly ITokenService _tokenService;
    private readonly IPasswordHasher _passwordHasher;
    private readonly ILoginThrottle _throttle;

    public AdminLoginCommandHandler(
        IUserRepository users, ITokenService tokenService, IPasswordHasher passwordHasher, ILoginThrottle throttle)
    {
        _users = users;
        _tokenService = tokenService;
        _passwordHasher = passwordHasher;
        _throttle = throttle;
    }

    public async Task<Result<AdminTokenResponse>> Handle(AdminLoginCommand request, CancellationToken cancellationToken)
    {
        // Shares the user login's counter, so alternating between the two endpoints buys no extra guesses.
        if (await _throttle.IsLockedOutAsync(request.Email, cancellationToken))
            return Result<AdminTokenResponse>.Failure(LoginThrottleMessages.LockedOut, LoginThrottleMessages.ErrorCode);

        var user = await _users.GetByEmailAsync(request.Email.ToLowerInvariant(), cancellationToken);

        // One answer for every failure. A distinct "correct password, but not an admin" reply turned this
        // endpoint into a password checker for every account on the platform.
        if (!PasswordCheck.Matches(_passwordHasher, user, request.Password) || !user!.IsAdmin || !user.IsActive)
        {
            await _throttle.RecordFailureAsync(request.Email, cancellationToken);
            return Result<AdminTokenResponse>.Failure("Invalid credentials.", "INVALID_CREDENTIALS");
        }

        await _throttle.ResetAsync(request.Email, cancellationToken);

        // The only token that carries the Admin role. Tokens from the user-facing sign-in paths never do,
        // so a script running in the user app can't reach the admin API with an admin's session.
        var token = _tokenService.GenerateAdminAccessToken(user);
        return Result<AdminTokenResponse>.Success(new AdminTokenResponse(token), "Login successful.");
    }
}
