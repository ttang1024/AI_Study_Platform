using Microsoft.EntityFrameworkCore;
using StudyPlatform.Domain.Entities;
using StudyPlatform.Domain.Interfaces;
using StudyPlatform.Infrastructure.Data;

namespace StudyPlatform.Infrastructure.Repositories;

public class RefreshTokenRepository : Repository<RefreshToken>, IRefreshTokenRepository
{
    public RefreshTokenRepository(AppDbContext context) : base(context) { }

    public async Task<RefreshToken?> FindByHashAsync(string tokenHash, CancellationToken cancellationToken = default)
        => await _dbSet.AsNoTracking().FirstOrDefaultAsync(t => t.Token == tokenHash, cancellationToken);

    public async Task<bool> TryRevokeAsync(Guid tokenId, CancellationToken cancellationToken = default)
    {
        var now = DateTime.UtcNow;
        var revoked = await _dbSet
            .Where(t => t.TokenId == tokenId && !t.IsRevoked)
            .ExecuteUpdateAsync(s => s
                .SetProperty(t => t.IsRevoked, true)
                .SetProperty(t => t.RevokedAt, now), cancellationToken);
        return revoked == 1;
    }

    public async Task RevokeSessionAsync(Guid userId, Guid sessionId, CancellationToken cancellationToken = default)
    {
        var now = DateTime.UtcNow;
        await _dbSet
            .Where(t => t.UserId == userId && t.SessionId == sessionId && !t.IsRevoked)
            .ExecuteUpdateAsync(s => s
                .SetProperty(t => t.IsRevoked, true)
                .SetProperty(t => t.RevokedAt, now), cancellationToken);
    }

    public async Task RevokeAllUserTokensAsync(Guid userId, CancellationToken cancellationToken = default)
    {
        var tokens = await _dbSet
            .Where(t => t.UserId == userId && !t.IsRevoked)
            .ToListAsync(cancellationToken);

        var now = DateTime.UtcNow;
        foreach (var token in tokens)
        {
            token.IsRevoked = true;
            token.RevokedAt = now;
        }
    }

}
