using Microsoft.AspNetCore.Mvc;
using StudyPlatform.Application.Services;

namespace StudyPlatform.API.Extensions;

public static class AiCredentialsExtensions
{
    /// <summary>
    /// Snapshots the AI credentials off the current request so deferred work can run under them.
    /// Validated here, at enqueue time, rather than in the worker: a missing key should fail the
    /// request the user is watching, not a job they've already been told was accepted.
    /// </summary>
    public static AiCredentials CaptureAiCredentials(this ControllerBase controller)
    {
        var headers = controller.Request.Headers;

        var provider = headers["X-AI-Provider"].FirstOrDefault();
        if (string.IsNullOrWhiteSpace(provider))
            throw new InvalidOperationException("No AI provider specified. Please configure a provider in Settings → AI Services.");

        var model = headers["X-AI-Model"].FirstOrDefault();
        if (string.IsNullOrWhiteSpace(model))
            throw new InvalidOperationException("No AI model specified. Please configure a model in Settings → AI Services.");

        var apiKey = headers["X-AI-Key"].FirstOrDefault()?.Trim();
        if (string.IsNullOrWhiteSpace(apiKey))
            throw new InvalidOperationException(
                $"No API key configured for provider '{provider.ToLowerInvariant()}'. Please add your API key in Settings → AI Services.");

        return new AiCredentials(provider.ToLowerInvariant(), model, apiKey, controller.User.GetUserId());
    }
}
