using Microsoft.EntityFrameworkCore;
using StudyPlatform.Domain.Entities;
using StudyPlatform.Domain.Interfaces;
using StudyPlatform.Infrastructure.Data;

namespace StudyPlatform.Infrastructure.Repositories;

public class ShareTokenRepository(AppDbContext context) : Repository<ShareToken>(context), IShareTokenRepository
{
    public async Task<ShareToken?> GetByTokenAsync(string token, CancellationToken cancellationToken = default)
        => await _context.ShareTokens
            .Include(s => s.Owner)
            .FirstOrDefaultAsync(s => s.Token == token, cancellationToken);
}
