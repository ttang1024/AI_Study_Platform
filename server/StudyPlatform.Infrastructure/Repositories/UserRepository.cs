using Microsoft.EntityFrameworkCore;
using StudyPlatform.Domain.Entities;
using StudyPlatform.Domain.Interfaces;
using StudyPlatform.Infrastructure.Data;

namespace StudyPlatform.Infrastructure.Repositories;

public class UserRepository : Repository<User>, IUserRepository
{
    public UserRepository(AppDbContext context) : base(context) { }

    public async Task<User?> GetByEmailAsync(string email, CancellationToken cancellationToken = default)
        => await _dbSet.FirstOrDefaultAsync(u => u.Email == email.ToLowerInvariant(), cancellationToken);

    public async Task<bool> EmailExistsAsync(string email, CancellationToken cancellationToken = default)
        => await _dbSet.AnyAsync(u => u.Email == email.ToLowerInvariant(), cancellationToken);

    public async Task<User?> GetByIdWithRefreshTokensAsync(Guid userId, CancellationToken cancellationToken = default)
        => await _dbSet
            .Include(u => u.RefreshTokens)
            .FirstOrDefaultAsync(u => u.UserId == userId, cancellationToken);

    public async Task<User?> GetByIdAsync(Guid userId, CancellationToken cancellationToken = default)
        => await _dbSet.FirstOrDefaultAsync(u => u.UserId == userId, cancellationToken);

    public async Task<(List<User> Items, int Total)> ListAsync(
        int page, int pageSize, string? search, string? status, string? sort,
        CancellationToken cancellationToken = default)
    {
        var query = _dbSet.AsQueryable();

        if (!string.IsNullOrWhiteSpace(search))
            query = query.Where(u => u.FullName.Contains(search) || u.Email.Contains(search));

        if (status == "active")
            query = query.Where(u => u.IsActive);
        else if (status == "inactive")
            query = query.Where(u => !u.IsActive);
        else if (status == "admin")
            query = query.Where(u => u.IsAdmin);

        query = sort == "oldest"
            ? query.OrderBy(u => u.CreatedAt)
            : query.OrderByDescending(u => u.CreatedAt);

        var total = await query.CountAsync(cancellationToken);
        var items = await query
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(cancellationToken);

        return (items, total);
    }
}
