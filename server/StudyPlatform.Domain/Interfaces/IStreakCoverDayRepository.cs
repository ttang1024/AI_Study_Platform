using StudyPlatform.Domain.Entities;

namespace StudyPlatform.Domain.Interfaces;

public interface IStreakCoverDayRepository : IRepository<StreakCoverDay>
{
    Task<IEnumerable<StreakCoverDay>> GetByUserAsync(Guid userId, CancellationToken cancellationToken = default);

    /// <summary>
    /// Records <paramref name="dates"/> as freeze days, skipping any date the user already has a cover
    /// row for, and returns how many were added. Writes immediately rather than on SaveChanges: it runs
    /// from the dashboard read, where two tabs loading at once must not both insert the same day.
    /// </summary>
    Task<int> AddFreezeDaysAsync(Guid userId, IReadOnlyCollection<DateTime> dates, CancellationToken cancellationToken = default);
}
