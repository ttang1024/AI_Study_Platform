using Microsoft.EntityFrameworkCore;
using StudyPlatform.Domain.Entities;
using StudyPlatform.Domain.Interfaces;
using StudyPlatform.Infrastructure.Data;

namespace StudyPlatform.Infrastructure.Repositories;

public class UserFsrsSettingsRepository : Repository<UserFsrsSettings>, IUserFsrsSettingsRepository
{
    public UserFsrsSettingsRepository(AppDbContext context) : base(context) { }

    public async Task<UserFsrsSettings?> GetByUserIdAsync(Guid userId, CancellationToken ct = default)
        => await _dbSet.FirstOrDefaultAsync(s => s.UserId == userId, ct);
}
