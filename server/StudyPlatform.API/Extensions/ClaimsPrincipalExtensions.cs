using System.Security.Claims;

namespace StudyPlatform.API.Extensions;

public static class ClaimsPrincipalExtensions
{
    public static Guid GetUserId(this ClaimsPrincipal principal)
    {
        var userIdClaim = principal.FindFirst(ClaimTypes.NameIdentifier);
        if (userIdClaim == null || !Guid.TryParse(userIdClaim.Value, out var userId))
            throw new UnauthorizedAccessException("User ID not found in token.");
        return userId;
    }

    /// <summary>
    /// The caller's id when there is one, null when there is not. For the few endpoints that
    /// serve anonymous visitors but attribute the request when a valid token happens to ride
    /// along — everything else should keep using <see cref="GetUserId"/> and its exception.
    /// </summary>
    public static Guid? GetUserIdOrNull(this ClaimsPrincipal principal)
    {
        var userIdClaim = principal.FindFirst(ClaimTypes.NameIdentifier);
        return userIdClaim != null && Guid.TryParse(userIdClaim.Value, out var userId) ? userId : null;
    }
}
