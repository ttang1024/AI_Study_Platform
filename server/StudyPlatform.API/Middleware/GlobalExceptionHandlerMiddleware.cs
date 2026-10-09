using System.Net;
using System.Text.Json;
using FluentValidation;
using StudyPlatform.API.Extensions;
using StudyPlatform.Application.Common;
using StudyPlatform.Domain.Exceptions;
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
        catch (OperationCanceledException) when (context.RequestAborted.IsCancellationRequested)
        {
            // The client went away (closed tab, CloudFront gave up). Not an error, and nobody to answer.
        }
        catch (ConcurrencyConflictException ex)
        {
            _logger.LogInformation(ex, "Concurrent update conflict");
            await HandleExceptionAsync(context, HttpStatusCode.Conflict, ex.Message, "CONCURRENCY_CONFLICT", Array.Empty<string>());
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
            // A KeyNotFoundException is as likely to be a dictionary miss as a missing entity, and its
            // message names internal keys — never echo it.
            await HandleExceptionAsync(context, HttpStatusCode.NotFound, "Resource not found.", "NOT_FOUND", Array.Empty<string>());
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
        catch (UserFacingException ex)
        {
            // Written for the user (AI provider/key problems, provider limits) — the one kind of
            // exception whose message is returned. Provider errors are refined to 429 / 502.
            _logger.LogWarning(ex, "User-facing failure");
            var (statusCode, errorCode) = AiErrorMapper.TryGetAiError(ex.Message, out var aiStatus, out var aiCode)
                ? (aiStatus, aiCode)
                : (ex.StatusCode, ex.ErrorCode);
            await HandleExceptionAsync(context, (HttpStatusCode)statusCode, ex.Message, errorCode, Array.Empty<string>());
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
        // Mid-stream (SSE) the status line is already sent; the stream carries its own [ERROR] frame.
        if (context.Response.HasStarted)
            return;

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
