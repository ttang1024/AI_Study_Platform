using StudyPlatform.Domain.Entities;

namespace StudyPlatform.Domain.Interfaces;

public interface IUserFsrsSettingsRepository : IRepository<UserFsrsSettings>
{
    Task<UserFsrsSettings?> GetByUserIdAsync(Guid userId, CancellationToken cancellationToken = default);
}
