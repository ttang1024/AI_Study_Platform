using Microsoft.AspNetCore.Mvc;
using StudyPlatform.Application.Common;
using StudyPlatform.Application.Services;

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

    /// <summary>
    /// Maps an exception thrown while probing an AI stream to an error <see cref="ObjectResult"/>.
    /// Shared by SSE streaming endpoints across controllers.
    /// </summary>
    /// <remarks>
    /// SSE endpoints probe the first chunk inside a try/catch, so quota / credential / provider
    /// failures never bubble up to <c>GlobalExceptionHandlerMiddleware</c>. This mirrors that
    /// middleware's mapping so a streamed call fails with the same status a non-streamed one would —
    /// a missing provider/key is a 400, an exhausted budget is a 429, not a blanket 502.
    /// </remarks>
    public static ObjectResult AiStreamError(this ControllerBase controller, Exception ex)
    {
        var (statusCode, errorCode) = MapException(ex);
        return controller.StatusCode(statusCode, BaseResponse<string>.Fail(ex.Message, errorCode));
    }

    private static (int statusCode, string errorCode) MapException(Exception ex)
    {
        if (ex is AiQuotaExceededException)
            return (StatusCodes.Status429TooManyRequests, "AI_QUOTA_EXCEEDED");

        if (TryGetAiError(ex.Message, out var statusCode, out var errorCode))
            return (statusCode, errorCode);

        // Unmatched InvalidOperationExceptions are client-side problems (no provider/model/key
        // configured, unreadable provider response) rather than an upstream gateway failure.
        if (ex is InvalidOperationException)
            return (StatusCodes.Status400BadRequest, "INVALID_OPERATION");

        return (StatusCodes.Status502BadGateway, "AI_PROVIDER_ERROR");
    }

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
