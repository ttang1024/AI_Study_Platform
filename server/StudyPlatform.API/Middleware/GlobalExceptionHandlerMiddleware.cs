using System.Net;
using System.Text.Json;
using FluentValidation;
using StudyPlatform.Application.Services;

namespace StudyPlatform.API.Middleware;

public class GlobalExceptionHandlerMiddleware
{
    private readonly RequestDelegate _next;
    private readonly ILogger<GlobalExceptionHandlerMiddleware> _logger;

    public GlobalExceptionHandlerMiddleware(RequestDelegate next, ILogger<GlobalExceptionHandlerMiddleware> logger)
    {
        _next = next;
        _logger = logger;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        try
        {
            await _next(context);
        }
        catch (ValidationException ex)
        {
            _logger.LogWarning(ex, "Validation error occurred");
            await HandleValidationExceptionAsync(context, ex);
        }
        catch (UnauthorizedAccessException ex)
        {
            _logger.LogWarning(ex, "Unauthorized access attempt");
            await HandleExceptionAsync(context, HttpStatusCode.Unauthorized, "Unauthorized", "UNAUTHORIZED", Array.Empty<string>());
        }
        catch (KeyNotFoundException ex)
        {
            _logger.LogWarning(ex, "Resource not found");
            await HandleExceptionAsync(context, HttpStatusCode.NotFound, ex.Message, "NOT_FOUND", Array.Empty<string>());
        }
        catch (YouTubeTranscriptUnavailableException ex)
        {
            _logger.LogWarning(ex, "YouTube transcript upstream is temporarily unavailable");
            await HandleExceptionAsync(
                context,
                HttpStatusCode.ServiceUnavailable,
                "YouTube transcript service is temporarily unavailable. Please retry shortly.",
                "YOUTUBE_TRANSCRIPT_UNAVAILABLE",
                Array.Empty<string>());
        }
        catch (InvalidOperationException ex)
        {
            _logger.LogError(ex, "Invalid operation");
            await HandleExceptionAsync(context, HttpStatusCode.BadRequest, ex.Message, "INVALID_OPERATION", Array.Empty<string>());
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "An unhandled exception occurred");
            await HandleExceptionAsync(context, HttpStatusCode.InternalServerError, "An unexpected error occurred.", "INTERNAL_SERVER_ERROR", Array.Empty<string>());
        }
    }

    private static async Task HandleValidationExceptionAsync(HttpContext context, ValidationException ex)
    {
        context.Response.StatusCode = (int)HttpStatusCode.BadRequest;
        context.Response.ContentType = "application/json";

        var errors = ex.Errors.Select(e => e.ErrorMessage).ToArray();
        var response = new
        {
            success = false,
            message = "Validation failed.",
            errorCode = "VALIDATION_ERROR",
            errors
        };

        await context.Response.WriteAsync(JsonSerializer.Serialize(response, new JsonSerializerOptions
        {
            PropertyNamingPolicy = JsonNamingPolicy.CamelCase
        }));
    }

    private static async Task HandleExceptionAsync(
        HttpContext context,
        HttpStatusCode statusCode,
        string message,
        string errorCode,
        IEnumerable<string> errors)
    {
        context.Response.StatusCode = (int)statusCode;
        context.Response.ContentType = "application/json";

        var response = new
        {
            success = false,
            message,
            errorCode,
            errors
        };

        await context.Response.WriteAsync(JsonSerializer.Serialize(response, new JsonSerializerOptions
        {
            PropertyNamingPolicy = JsonNamingPolicy.CamelCase
        }));
    }
}
