namespace StudyPlatform.Application.Services;

/// <summary>
/// The bits of the ambient HTTP request that handlers legitimately need — who is calling from where.
///
/// <para>An interface in Application rather than an <c>IHttpContextAccessor</c> dependency so
/// handlers stay testable and so background work, which has no request at all, gets nulls instead
/// of a null-reference. Every member is nullable for that reason.</para>
/// </summary>
public interface IRequestContext
{
    string? UserAgent { get; }
    string? IpAddress { get; }

    /// <summary>
    /// A short label for the calling device, e.g. "Chrome on macOS", derived from the user agent.
    /// Best-effort and cosmetic: it exists so a user can recognise their own sessions, and nothing
    /// authorizes off it.
    /// </summary>
    string? DeviceName { get; }
}
