using StudyPlatform.Domain.Entities;

namespace StudyPlatform.Domain.Interfaces;

public interface IStudySessionRepository : IRepository<StudySession>
{
    Task<IEnumerable<StudySession>> GetByDateRangeAsync(Guid userId, DateTime from, DateTime to, CancellationToken cancellationToken = default);
}
