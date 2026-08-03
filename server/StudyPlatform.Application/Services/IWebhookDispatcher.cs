namespace StudyPlatform.Application.Services;

/// <summary>
/// Posts an event to whichever of a user's webhooks subscribe to it.
///
/// <para>Fire-and-forget from the caller's point of view: a study action must not fail, or wait, on
/// somebody's endpoint being reachable.</para>
/// </summary>
public interface IWebhookDispatcher
{
    /// <param name="eventName">One of <c>WebhookEvents</c>.</param>
    /// <param name="payload">Serialised as the JSON body under <c>data</c>.</param>
    Task DispatchAsync(Guid userId, string eventName, object payload, CancellationToken cancellationToken = default);
}
