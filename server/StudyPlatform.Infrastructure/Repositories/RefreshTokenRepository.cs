using Microsoft.EntityFrameworkCore;
using StudyPlatform.Domain.Entities;
using StudyPlatform.Domain.Interfaces;
using StudyPlatform.Infrastructure.Data;

namespace StudyPlatform.Infrastructure.Repositories;

public class RefreshTokenRepository : Repository<RefreshToken>, IRefreshTokenRepository
{
    public RefreshTokenRepository(AppDbContext context) : base(context) { }

    public async Task<RefreshToken?> GetValidTokenAsync(string token, CancellationToken cancellationToken = default)
        => await _dbSet.FirstOrDefaultAsync(t =>
            t.Token == token &&
            !t.IsRevoked &&
            t.ExpiresAt > DateTime.UtcNow,
            cancellationToken);

    public async Task RevokeAllUserTokensAsync(Guid userId, CancellationToken cancellationToken = default)
    {
        var tokens = await _dbSet
            .Where(t => t.UserId == userId && !t.IsRevoked)
            .ToListAsync(cancellationToken);

        foreach (var token in tokens)
            token.IsRevoked = true;
    }
}
