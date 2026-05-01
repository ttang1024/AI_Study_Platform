using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using StudyPlatform.Application.Common;

namespace StudyPlatform.API.Extensions;

public static class AiErrorMapper
{
    public static bool TryGetAiError(string? message, out int statusCode, out string errorCode)
    {
        message ??= string.Empty;

        if (message.Contains("TooManyRequests", StringComparison.OrdinalIgnoreCase) ||
            message.Contains("429", StringComparison.OrdinalIgnoreCase) ||
            message.Contains("quota", StringComparison.OrdinalIgnoreCase) ||
            message.Contains("rate limit", StringComparison.OrdinalIgnoreCase))
        {
            statusCode = StatusCodes.Status429TooManyRequests;
            errorCode = "AI_QUOTA_EXCEEDED";
            return true;
        }

        if (message.Contains(" API returned ", StringComparison.OrdinalIgnoreCase) ||
            message.Contains(" streaming API returned ", StringComparison.OrdinalIgnoreCase))
        {
            statusCode = StatusCodes.Status502BadGateway;
            errorCode = "AI_PROVIDER_ERROR";
            return true;
        }

        statusCode = StatusCodes.Status500InternalServerError;
        errorCode = "AI_PROVIDER_ERROR";
        return false;
    }

    public static ObjectResult ToObjectResult(ControllerBase controller, string message)
        => ToObjectResult<string>(controller, message);

    public static ObjectResult ToObjectResult<T>(ControllerBase controller, string message)
    {
        if (!TryGetAiError(message, out var statusCode, out var errorCode))
        {
            statusCode = StatusCodes.Status502BadGateway;
            errorCode = "AI_PROVIDER_ERROR";
        }

        return controller.StatusCode(statusCode, BaseResponse<T>.Fail(message, errorCode));
    }
}
