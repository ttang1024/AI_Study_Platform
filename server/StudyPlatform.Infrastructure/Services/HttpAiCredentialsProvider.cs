using System.Security.Claims;
using Microsoft.AspNetCore.Http;
using StudyPlatform.Application.Common;
using StudyPlatform.Application.Services;

namespace StudyPlatform.Infrastructure.Services;

/// <summary><see cref="IAiCredentialsProvider"/> over the current request's X-AI-* headers.</summary>
public sealed class HttpAiCredentialsProvider : IAiCredentialsProvider
{
    private readonly IHttpContextAccessor _httpContextAccessor;

    public HttpAiCredentialsProvider(IHttpContextAccessor httpContextAccessor)
        => _httpContextAccessor = httpContextAccessor;

    public AiCredentials GetRequired()
    {
        var http = _httpContextAccessor.HttpContext;
        var headers = http?.Request.Headers;

        var provider = headers?["X-AI-Provider"].FirstOrDefault()?.Trim().ToLowerInvariant();
        var model = headers?["X-AI-Model"].FirstOrDefault()?.Trim();
        var key = headers?["X-AI-Key"].FirstOrDefault()?.Trim();

        if (string.IsNullOrWhiteSpace(provider))
            throw new UserFacingException("No AI provider specified. Please configure a provider in Settings → AI Services.");

        // An unrecognised provider used to be sent to Gemini with whatever key came with it.
        if (!AiProviders.Supported.Contains(provider))
            throw new UserFacingException($"Unsupported AI provider '{provider}'. Please choose a provider in Settings → AI Services.");

        if (string.IsNullOrWhiteSpace(model))
            throw new UserFacingException("No AI model specified. Please configure a model in Settings → AI Services.");

        if (string.IsNullOrWhiteSpace(key))
            throw new UserFacingException(
                $"No API key configured for provider '{provider}'. Please add your API key in Settings → AI Services.");

        return new AiCredentials(provider, model, key, CurrentUserId(http?.User));
    }

    private static Guid CurrentUserId(ClaimsPrincipal? user)
    {
        var claim = user?.FindFirst("sub")?.Value ?? user?.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        return Guid.TryParse(claim, out var id) ? id : Guid.Empty;
    }
}
