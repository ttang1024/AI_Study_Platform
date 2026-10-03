using MediatR;
using StudyPlatform.Application.Auth.DTOs;
using StudyPlatform.Application.Common;
using StudyPlatform.Application.Services;

namespace StudyPlatform.Application.Auth.Commands;

public record OAuthLoginCommand(string Provider, string Code, string RedirectUri) : IRequest<Result<AuthResponse>>;
public record GoogleCredentialLoginCommand(string Credential) : IRequest<Result<AuthResponse>>;

public class OAuthLoginCommandHandler : IRequestHandler<OAuthLoginCommand, Result<AuthResponse>>
{
    private readonly IOAuthService _oAuthService;
    private readonly IExternalSignIn _externalSignIn;

    public OAuthLoginCommandHandler(IOAuthService oAuthService, IExternalSignIn externalSignIn)
    {
        _oAuthService = oAuthService;
        _externalSignIn = externalSignIn;
    }

    public async Task<Result<AuthResponse>> Handle(OAuthLoginCommand request, CancellationToken cancellationToken)
    {
        var userInfo = await _oAuthService.GetUserInfoAsync(
            request.Provider, request.Code, request.RedirectUri, cancellationToken);
        if (userInfo == null)
            return Result<AuthResponse>.Failure($"Failed to authenticate with {request.Provider}. Please try again.", "OAUTH_FAILED");

        return await _externalSignIn.CompleteAsync(userInfo, cancellationToken);
    }
}

public class GoogleCredentialLoginCommandHandler : IRequestHandler<GoogleCredentialLoginCommand, Result<AuthResponse>>
{
    private readonly IOAuthService _oAuthService;
    private readonly IExternalSignIn _externalSignIn;

    public GoogleCredentialLoginCommandHandler(IOAuthService oAuthService, IExternalSignIn externalSignIn)
    {
        _oAuthService = oAuthService;
        _externalSignIn = externalSignIn;
    }

    public async Task<Result<AuthResponse>> Handle(GoogleCredentialLoginCommand request, CancellationToken cancellationToken)
    {
        var userInfo = await _oAuthService.GetGoogleUserInfoFromCredentialAsync(request.Credential, cancellationToken);
        if (userInfo == null)
            return Result<AuthResponse>.Failure("Failed to authenticate with Google. Please try again.", "GOOGLE_CREDENTIAL_FAILED");

        return await _externalSignIn.CompleteAsync(userInfo, cancellationToken);
    }
}
