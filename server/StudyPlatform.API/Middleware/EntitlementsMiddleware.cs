using StudyPlatform.Application.Billing;
using StudyPlatform.Infrastructure.Services;

namespace StudyPlatform.API.Middleware;

/// <summary>
/// Resolves the caller's plan once per request and leaves it on the HttpContext.
///
/// This exists so credential and quota decisions — which happen deep inside AiService on a
/// synchronous path — can read an entitlement without an await or a second database round trip.
/// Resolution is cached in the entitlement service itself, so the cost here is a cache read.
/// </summary>
public class EntitlementsMiddleware
{
    private readonly RequestDelegate _next;

    public EntitlementsMiddleware(RequestDelegate next) => _next = next;

    public async Task InvokeAsync(HttpContext context, IEntitlementService entitlements)
    {
        if (context.User?.Identity?.IsAuthenticated == true)
        {
            var claim = context.User.FindFirst("sub")?.Value
                        ?? context.User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;

            if (Guid.TryParse(claim, out var userId))
            {
                // Never let a billing lookup fail a request; the service already degrades to Free.
                context.Items[HostedAiKeyProvider.EntitlementItemKey] =
                    await entitlements.GetForUserAsync(userId, context.RequestAborted);
            }
        }

        await _next(context);
    }
}

public static class EntitlementsMiddlewareExtensions
{
    /// <summary>Must run after authentication, so the user's identity is available.</summary>
    public static IApplicationBuilder UseEntitlements(this IApplicationBuilder app)
        => app.UseMiddleware<EntitlementsMiddleware>();
}
