namespace StudyPlatform.Domain.Interfaces;

/// <summary>An entity that belongs to exactly one user. See <see cref="OwnedRepositoryExtensions"/>.</summary>
public interface IUserOwned
{
    Guid UserId { get; }
}

public static class OwnedRepositoryExtensions
{
    /// <summary>
    /// The entity with this id if — and only if — <paramref name="userId"/> owns it; null otherwise.
    ///
    /// <para>The one way handlers load something by an id that came from the client. A plain
    /// <c>GetByIdAsync</c> returns any user's row, so every caller had to remember its own
    /// <c>UserId</c> comparison; forgetting it once is an IDOR. "Not yours" and "does not exist" are
    /// deliberately indistinguishable, so ids of other users' content cannot be probed.</para>
    /// </summary>
    public static async Task<T?> GetOwnedAsync<T>(
        this IRepository<T> repository, Guid id, Guid userId, CancellationToken cancellationToken = default)
        where T : class, IUserOwned
    {
        var entity = await repository.GetByIdAsync(id, cancellationToken);
        return entity != null && entity.UserId == userId ? entity : null;
    }
}
