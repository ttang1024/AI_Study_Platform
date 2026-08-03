using StudyPlatform.Domain.Entities;

namespace StudyPlatform.Domain.Interfaces;

public interface IApiKeyRepository : IRepository<ApiKey>
{
    Task<IReadOnlyList<ApiKey>> GetForUserAsync(Guid userId, CancellationToken cancellationToken = default);

    /// <summary>
    /// Resolves a presented key by its hash. Indexed on the hash so authentication is a single
    /// point lookup rather than a scan — this runs on every API-key request.
    /// </summary>
    Task<ApiKey?> GetByHashAsync(string keyHash, CancellationToken cancellationToken = default);

    /// <summary>
    /// Records use without going through the change tracker, and only if the stored timestamp is
    /// already older than <paramref name="staleAfter"/>. Keeps "last used" from turning every
    /// authenticated request into a write.
    /// </summary>
    Task TouchAsync(Guid apiKeyId, TimeSpan staleAfter, CancellationToken cancellationToken = default);
}

public interface IWebhookRepository : IRepository<Webhook>
{
    Task<IReadOnlyList<Webhook>> GetForUserAsync(Guid userId, CancellationToken cancellationToken = default);

    /// <summary>Active endpoints of one user subscribed to a given event.</summary>
    Task<IReadOnlyList<Webhook>> GetSubscribersAsync(
        Guid userId, string eventName, CancellationToken cancellationToken = default);
}
