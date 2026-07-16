using StudyPlatform.Domain.Entities;

namespace StudyPlatform.Domain.Interfaces;

public interface IStreakCoverDayRepository : IRepository<StreakCoverDay>
{
    Task<IEnumerable<StreakCoverDay>> GetByUserAsync(Guid userId, CancellationToken cancellationToken = default);
}
