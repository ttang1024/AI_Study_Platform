namespace StudyPlatform.Application.Services;

/// <summary>The provider/model/key triple an AI call runs under, plus the user it is billed to.</summary>
public sealed record AiCredentials(string Provider, string Model, string ApiKey, Guid UserId)
{
    /// <summary>
    /// The part of an AI result cache key that says whose result it is. Generated results are cached per
    /// user: a shared entry let anyone with a placeholder key read results another user paid for, and
    /// whether a request came back cached told them someone else had submitted the same file.
    /// </summary>
    public string CacheScope => $"{UserId:N}:{Provider}:{Model}";
}

/// <summary>
/// Where an AI call's credentials come from. Keys are never stored server-side: the client sends them
/// with each request (X-AI-* headers), so only request-bound work can have them.
/// </summary>
public interface IAiCredentialsProvider
{
    /// <summary>The caller's credentials, or a <see cref="Common.UserFacingException"/> saying what is missing.</summary>
    AiCredentials GetRequired();
}

/// <summary>The AI providers the server can call. Kept in step with AiService's endpoint table.</summary>
public static class AiProviders
{
    public static readonly IReadOnlySet<string> Supported = new HashSet<string>(StringComparer.Ordinal)
    {
        "gemini", "openai", "claude", "grok", "deepseek", "kimi", "doubao", "qwen", "wenxin",
    };
}
