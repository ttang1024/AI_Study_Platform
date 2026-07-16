using System.Linq.Expressions;

namespace StudyPlatform.Domain.Interfaces;

public interface IRepository<T> where T : class
{
    Task<T?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default);
    Task<IEnumerable<T>> GetAllAsync(CancellationToken cancellationToken = default);
    Task<IEnumerable<T>> FindAsync(Expression<Func<T, bool>> predicate, CancellationToken cancellationToken = default);

    /// <summary>
    /// FindAsync without change tracking. Use this from query handlers: they project to DTOs and never
    /// save, so the snapshots EF takes for tracking are pure overhead — and it is not a small one when
    /// the rows are documents or videos carrying a full transcript.
    ///
    /// Entities returned here are detached. Passing one to Update() or mutating it and calling
    /// SaveChanges will not persist anything, so anything on a write path must keep using FindAsync.
    /// </summary>
    Task<IEnumerable<T>> FindAsNoTrackingAsync(Expression<Func<T, bool>> predicate, CancellationToken cancellationToken = default);

    Task<T?> FirstOrDefaultAsync(Expression<Func<T, bool>> predicate, CancellationToken cancellationToken = default);
    Task AddAsync(T entity, CancellationToken cancellationToken = default);
    Task AddRangeAsync(IEnumerable<T> entities, CancellationToken cancellationToken = default);
    void Update(T entity);
    void Remove(T entity);
    void RemoveRange(IEnumerable<T> entities);
    Task<int> CountAsync(Expression<Func<T, bool>>? predicate = null, CancellationToken cancellationToken = default);
    Task<bool> ExistsAsync(Expression<Func<T, bool>> predicate, CancellationToken cancellationToken = default);
}
