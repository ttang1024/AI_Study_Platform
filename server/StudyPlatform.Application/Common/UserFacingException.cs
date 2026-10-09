namespace StudyPlatform.Application.Common;

/// <summary>
/// An exception whose message was written for the end user and is safe to return to the client.
///
/// <para>Expected failures are normally <see cref="Result{T}"/> values; this is for the few that surface
/// from deep inside a service call (no AI provider configured, the provider rejected the key, a file
/// over a provider limit). Every other exception's message is treated as internal — it can carry SQL,
/// storage paths, upstream stack details — and the client gets a generic message instead
/// (see <see cref="ClientErrors"/>).</para>
///
/// <para>Derives from <see cref="InvalidOperationException"/> so existing <c>catch</c> sites that
/// handled these failures by that type keep doing so.</para>
/// </summary>
public class UserFacingException : InvalidOperationException
{
    public UserFacingException(string message, string errorCode = "INVALID_OPERATION", int statusCode = 400, Exception? inner = null)
        : base(message, inner)
    {
        ErrorCode = errorCode;
        StatusCode = statusCode;
    }

    public string ErrorCode { get; }

    public int StatusCode { get; }
}

/// <summary>The AI provider answered with an error (bad key, quota, outage); its text is the user's to see.</summary>
public sealed class AiProviderException : UserFacingException
{
    public AiProviderException(string message) : base(message, "AI_PROVIDER_ERROR", 502)
    {
    }
}

public static class ClientErrors
{
    /// <summary>The exception's own message when it is meant for users, otherwise <paramref name="fallback"/>.</summary>
    public static string MessageFor(Exception ex, string fallback)
        => ex is UserFacingException ? ex.Message : fallback;
}
