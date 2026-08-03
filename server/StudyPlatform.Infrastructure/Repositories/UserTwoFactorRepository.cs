using Microsoft.EntityFrameworkCore;
using StudyPlatform.Domain.Entities;
using StudyPlatform.Domain.Interfaces;
using StudyPlatform.Infrastructure.Data;

namespace StudyPlatform.Infrastructure.Repositories;

public class UserTwoFactorRepository : Repository<UserTwoFactor>, IUserTwoFactorRepository
{
    public UserTwoFactorRepository(AppDbContext context) : base(context) { }

    public async Task<UserTwoFactor?> GetByUserIdAsync(Guid userId, CancellationToken cancellationToken = default)
        => await _dbSet.FirstOrDefaultAsync(f => f.UserId == userId, cancellationToken);
}
