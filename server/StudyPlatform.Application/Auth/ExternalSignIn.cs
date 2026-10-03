using StudyPlatform.Application.Auth.DTOs;
using StudyPlatform.Application.Common;
using StudyPlatform.Application.Services;
using StudyPlatform.Domain.Entities;
using StudyPlatform.Domain.Interfaces;

namespace StudyPlatform.Application.Auth;

/// <inheritdoc cref="IExternalSignIn"/>
public class ExternalSignIn : IExternalSignIn
{
    private readonly IUnitOfWork _unitOfWork;
    private readonly IAuthSessionIssuer _sessionIssuer;

    public ExternalSignIn(IUnitOfWork unitOfWork, IAuthSessionIssuer sessionIssuer)
    {
        _unitOfWork = unitOfWork;
        _sessionIssuer = sessionIssuer;
    }

    public async Task<Result<AuthResponse>> CompleteAsync(
        OAuthUserInfo userInfo, CancellationToken cancellationToken = default)
    {
        var email = userInfo.Email.ToLowerInvariant();
        var user = await _unitOfWork.Users.GetByEmailAsync(email, cancellationToken);

        if (user == null)
        {
            // The provider has already verified the address, and there is no local password to set.
            user = new User
            {
                UserId = Guid.NewGuid(),
                Email = email,
                PasswordHash = string.Empty,
                FullName = userInfo.FullName,
                IsEmailVerified = true,
                IsActive = true,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            };
            await _unitOfWork.Users.AddAsync(user, cancellationToken);
        }

        if (!user.IsActive)
            return Result<AuthResponse>.Failure("Your account has been deactivated. Please contact support.", "ACCOUNT_DEACTIVATED");

        var response = await _sessionIssuer.IssueAsync(user, cancellationToken: cancellationToken);
        return Result<AuthResponse>.Success(response, "Login successful.");
    }
}
