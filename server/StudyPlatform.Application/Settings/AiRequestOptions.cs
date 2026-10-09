namespace StudyPlatform.Application.Settings;

/// <summary>Deadlines for calls to the AI providers (section <c>Ai</c>).</summary>
public class AiRequestOptions
{
    public const string SectionName = "Ai";

    /// <summary>
    /// How long a non-streaming call, or a streaming call's wait for its first response, may take.
    /// Below CloudFront's 60-second origin timeout on purpose: past it the viewer gets a bare 504 from
    /// the CDN while the provider keeps generating (and billing the user's key) for nobody. Hitting this
    /// instead cancels the provider call and answers with a clear AI_TIMEOUT.
    /// </summary>
    public int NonStreamingTimeoutSeconds { get; set; } = 55;
}
