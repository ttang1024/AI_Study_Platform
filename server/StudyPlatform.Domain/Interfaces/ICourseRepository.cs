using StudyPlatform.Domain.Entities;
using StudyPlatform.Domain.Projections;

namespace StudyPlatform.Domain.Interfaces;

public interface ICourseRepository : IRepository<Course>
{
    /// <summary>
    /// Every course a user owns, most recently updated first, each with its document count computed in
    /// SQL. Read-only: to mutate a course, load it with <see cref="IRepository{T}.GetByIdAsync"/>.
    /// </summary>
    Task<IReadOnlyList<CourseListItem>> GetListItemsByUserAsync(Guid userId, CancellationToken cancellationToken = default);

    /// <summary>One course in the same shape as <see cref="GetListItemsByUserAsync"/>.</summary>
    Task<CourseListItem?> GetListItemByIdAsync(Guid courseId, CancellationToken cancellationToken = default);

    Task<bool> BelongsToUserAsync(Guid courseId, Guid userId, CancellationToken cancellationToken = default);
}
