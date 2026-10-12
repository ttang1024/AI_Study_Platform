namespace StudyPlatform.Application.Common;

/// <summary>
/// An AI result on its way to an SSE response: either already known (<see cref="Cached"/>) or a stream
/// still to be read, with <see cref="OnCompleted"/> run on the full text once it has been.
/// </summary>
public sealed record AiTextStream(
    string? Cached,
    IAsyncEnumerable<string>? Stream,
    Func<string, CancellationToken, Task>? OnCompleted)
{
    public static AiTextStream FromCache(string text) => new(text, null, null);
}
