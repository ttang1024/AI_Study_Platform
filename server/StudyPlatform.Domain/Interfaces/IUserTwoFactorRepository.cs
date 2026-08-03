using StudyPlatform.Domain.Entities;

namespace StudyPlatform.Domain.Interfaces;

public interface IUserTwoFactorRepository : IRepository<UserTwoFactor>
{
    Task<UserTwoFactor?> GetByUserIdAsync(Guid userId, CancellationToken cancellationToken = default);
}
