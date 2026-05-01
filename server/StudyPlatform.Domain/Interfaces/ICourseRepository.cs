using StudyPlatform.Domain.Entities;

namespace StudyPlatform.Domain.Interfaces;

public interface ICourseRepository : IRepository<Course>
{
    Task<IEnumerable<Course>> GetByUserIdAsync(Guid userId, CancellationToken cancellationToken = default);
    Task<Course?> GetByIdWithDocumentsAsync(Guid courseId, CancellationToken cancellationToken = default);
    Task<bool> BelongsToUserAsync(Guid courseId, Guid userId, CancellationToken cancellationToken = default);
}
