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

        var now = DateTime.UtcNow;
        foreach (var token in tokens)
        {
            token.IsRevoked = true;
            token.RevokedAt = now;
        }
    }

    public async Task<IReadOnlyList<ActiveSession>> GetActiveSessionsAsync(
        Guid userId, string? currentToken, CancellationToken cancellationToken = default)
    {
        var live = await _dbSet
            .AsNoTracking()
            .Where(t => t.UserId == userId && !t.IsRevoked && t.ExpiresAt > DateTime.UtcNow)
            .Select(t => new
            {
                t.SessionId,
                t.DeviceName,
                t.IpAddress,
                t.CreatedAt,
                t.LastUsedAt,
                t.ExpiresAt,
                IsCurrent = currentToken != null && t.Token == currentToken,
            })
            .ToListAsync(cancellationToken);

        // Grouped in memory rather than in SQL. Only the live tokens for one user are in hand — a
        // handful of rows — and expressing "the newest row's device, the oldest row's start" as a
        // single translatable group-by costs more in query complexity than it saves here.
        return live
            .GroupBy(t => t.SessionId)
            .Select(g =>
            {
                var newest = g.OrderByDescending(t => t.CreatedAt).First();
                return new ActiveSession(
                    g.Key,
                    newest.DeviceName,
                    newest.IpAddress,
                    g.Min(t => t.CreatedAt),
                    g.Max(t => t.LastUsedAt ?? t.CreatedAt),
                    g.Max(t => t.ExpiresAt),
                    g.Any(t => t.IsCurrent));
            })
            .OrderByDescending(s => s.LastUsedAt ?? s.StartedAt)
            .ToList();
    }

    public async Task<bool> RevokeSessionAsync(
        Guid userId, Guid sessionId, CancellationToken cancellationToken = default)
    {
        var tokens = await _dbSet
            .Where(t => t.UserId == userId && t.SessionId == sessionId && !t.IsRevoked)
            .ToListAsync(cancellationToken);

        if (tokens.Count == 0)
            return false;

        var now = DateTime.UtcNow;
        foreach (var token in tokens)
        {
            token.IsRevoked = true;
            token.RevokedAt = now;
        }

        return true;
    }

    public async Task<int> RevokeOtherSessionsAsync(
        Guid userId, string? currentToken, CancellationToken cancellationToken = default)
    {
        var live = await _dbSet
            .Where(t => t.UserId == userId && !t.IsRevoked)
            .ToListAsync(cancellationToken);

        // Identified by session, not by token: the caller's session may hold more than one live row
        // mid-rotation, and excluding only the exact token presented would sign them out of their own
        // device a moment later.
        var currentSessionId = string.IsNullOrEmpty(currentToken)
            ? (Guid?)null
            : live.FirstOrDefault(t => t.Token == currentToken)?.SessionId;

        var doomed = live.Where(t => t.SessionId != currentSessionId).ToList();

        var now = DateTime.UtcNow;
        foreach (var token in doomed)
        {
            token.IsRevoked = true;
            token.RevokedAt = now;
        }

        return doomed.Select(t => t.SessionId).Distinct().Count();
    }
}
