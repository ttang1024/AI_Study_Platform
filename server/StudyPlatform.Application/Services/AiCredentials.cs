namespace StudyPlatform.Application.Services;

/// <summary>The provider/model/key triple an AI call runs under, plus the user it is billed to.</summary>
public sealed record AiCredentials(string Provider, string Model, string ApiKey, Guid UserId);

/// <summary>
/// AI credentials normally arrive as X-AI-* headers on the request, so anything running outside a
/// request — the background queues — has no HttpContext to read them from. Deferred work captures
/// the caller's credentials at enqueue time and pushes them here for the duration of the job;
/// AiService prefers this over the headers whenever it is set.
/// </summary>
public static class AmbientAiCredentials
{
    private static readonly AsyncLocal<AiCredentials?> Current = new();

    public static AiCredentials? Value => Current.Value;

    public static IDisposable Push(AiCredentials credentials)
    {
        var previous = Current.Value;
        Current.Value = credentials;
        return new Scope(previous);
    }

    private sealed class Scope(AiCredentials? previous) : IDisposable
    {
        private bool _disposed;

        public void Dispose()
        {
            if (_disposed) return;
            _disposed = true;
            Current.Value = previous;
        }
    }
}
