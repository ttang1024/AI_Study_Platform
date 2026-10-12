namespace StudyPlatform.Domain.Interfaces;

/// <summary>
/// Commits everything the request's repositories have changed, as one transaction. Repositories are
/// injected individually where they're used; they share the request's DbContext, so this one save covers
/// all of them.
/// </summary>
public interface IUnitOfWork
{
    Task<int> SaveChangesAsync(CancellationToken cancellationToken = default);
}
