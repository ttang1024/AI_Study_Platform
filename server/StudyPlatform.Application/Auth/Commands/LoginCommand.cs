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
    private readonly IUnitOfWork _unitOfWork;
    private readonly IPasswordHasher _passwordHasher;
    private readonly IAuthSessionIssuer _sessionIssuer;

    public LoginCommandHandler(
        IUnitOfWork unitOfWork,
        IPasswordHasher passwordHasher,
        IAuthSessionIssuer sessionIssuer)
    {
        _unitOfWork = unitOfWork;
        _passwordHasher = passwordHasher;
        _sessionIssuer = sessionIssuer;
    }

    private static string? DummyHash;

    public async Task<Result<AuthResponse>> Handle(LoginCommand request, CancellationToken cancellationToken)
    {
        var user = await _unitOfWork.Users.GetByEmailAsync(request.Email.ToLowerInvariant(), cancellationToken);
        if (user == null)
        {
            // Spend the same bcrypt work as a real check, so response time does not reveal whether the
            // email is registered.
            _passwordHasher.Verify(request.Password, DummyHash ??= _passwordHasher.Hash(Guid.NewGuid().ToString()));
            return Result<AuthResponse>.Failure("Invalid email or password.", "INVALID_CREDENTIALS");
        }

        if (!_passwordHasher.Verify(request.Password, user.PasswordHash))
        {
            return Result<AuthResponse>.Failure("Invalid email or password.", "INVALID_CREDENTIALS");
        }

        if (!user.IsEmailVerified)
            return Result<AuthResponse>.Failure("Email not verified.", "EMAIL_NOT_VERIFIED");

        PendingDeletion.CancelOnSignIn(user);

        if (!user.IsActive)
            return Result<AuthResponse>.Failure("Your account has been deactivated. Please contact support.", "ACCOUNT_DEACTIVATED");

        var response = await _sessionIssuer.IssueAsync(user, cancellationToken: cancellationToken);
        return Result<AuthResponse>.Success(response, "Login successful.");
    }
}
