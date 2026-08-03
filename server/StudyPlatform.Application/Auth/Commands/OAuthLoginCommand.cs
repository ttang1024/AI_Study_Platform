using MediatR;
using StudyPlatform.Application.Auth.DTOs;
using StudyPlatform.Application.Common;
using StudyPlatform.Application.Services;
using StudyPlatform.Domain.Entities;
using StudyPlatform.Domain.Interfaces;

namespace StudyPlatform.Application.Auth.Commands;

public record OAuthLoginCommand(string Provider, string Code, string RedirectUri) : IRequest<Result<AuthResponse>>;
public record GoogleCredentialLoginCommand(string Credential) : IRequest<Result<AuthResponse>>;

public class OAuthLoginCommandHandler : IRequestHandler<OAuthLoginCommand, Result<AuthResponse>>
{
    private readonly IUnitOfWork _unitOfWork;
    private readonly ITokenService _tokenService;
    private readonly IOAuthService _oAuthService;
    private readonly IRequestContext _requestContext;

    public OAuthLoginCommandHandler(
        IUnitOfWork unitOfWork, ITokenService tokenService, IOAuthService oAuthService,
        IRequestContext requestContext)
    {
        _unitOfWork = unitOfWork;
        _tokenService = tokenService;
        _oAuthService = oAuthService;
        _requestContext = requestContext;
    }

    public async Task<Result<AuthResponse>> Handle(OAuthLoginCommand request, CancellationToken cancellationToken)
    {
        var userInfo = await _oAuthService.GetUserInfoAsync(request.Provider, request.Code, request.RedirectUri, cancellationToken);
        if (userInfo == null)
            return Result<AuthResponse>.Failure($"Failed to authenticate with {request.Provider}. Please try again.", "OAUTH_FAILED");

        var user = await _unitOfWork.Users.GetByEmailAsync(userInfo.Email.ToLowerInvariant(), cancellationToken);

        if (user == null)
        {
            user = new User
            {
                UserId = Guid.NewGuid(),
                Email = userInfo.Email.ToLowerInvariant(),
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

        var accessToken = _tokenService.GenerateAccessToken(user);
        var refreshTokenValue = _tokenService.GenerateRefreshToken();
        var refreshToken = RefreshTokenFactory.Create(user.UserId, refreshTokenValue, _requestContext);

        await _unitOfWork.RefreshTokens.AddAsync(refreshToken, cancellationToken);
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        var response = new AuthResponse(
            user.UserId,
            user.Email,
            user.FullName,
            accessToken,
            refreshTokenValue,
            DateTime.UtcNow.AddMinutes(15));

        return Result<AuthResponse>.Success(response, "Login successful.");
    }
}

public class GoogleCredentialLoginCommandHandler : IRequestHandler<GoogleCredentialLoginCommand, Result<AuthResponse>>
{
    private readonly IUnitOfWork _unitOfWork;
    private readonly ITokenService _tokenService;
    private readonly IOAuthService _oAuthService;

    private readonly IRequestContext _requestContext;

    public GoogleCredentialLoginCommandHandler(
        IUnitOfWork unitOfWork, ITokenService tokenService, IOAuthService oAuthService,
        IRequestContext requestContext)
    {
        _unitOfWork = unitOfWork;
        _tokenService = tokenService;
        _oAuthService = oAuthService;
        _requestContext = requestContext;
    }

    public async Task<Result<AuthResponse>> Handle(GoogleCredentialLoginCommand request, CancellationToken cancellationToken)
    {
        var userInfo = await _oAuthService.GetGoogleUserInfoFromCredentialAsync(request.Credential, cancellationToken);
        if (userInfo == null)
            return Result<AuthResponse>.Failure("Failed to authenticate with Google. Please try again.", "GOOGLE_CREDENTIAL_FAILED");

        var user = await _unitOfWork.Users.GetByEmailAsync(userInfo.Email.ToLowerInvariant(), cancellationToken);

        if (user == null)
        {
            user = new User
            {
                UserId = Guid.NewGuid(),
                Email = userInfo.Email.ToLowerInvariant(),
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

        var accessToken = _tokenService.GenerateAccessToken(user);
        var refreshTokenValue = _tokenService.GenerateRefreshToken();
        var refreshToken = RefreshTokenFactory.Create(user.UserId, refreshTokenValue, _requestContext);

        await _unitOfWork.RefreshTokens.AddAsync(refreshToken, cancellationToken);
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        var response = new AuthResponse(
            user.UserId,
            user.Email,
            user.FullName,
            accessToken,
            refreshTokenValue,
            DateTime.UtcNow.AddMinutes(15));

        return Result<AuthResponse>.Success(response, "Login successful.");
    }
}
