using Microsoft.EntityFrameworkCore;
using StudyPlatform.Domain.Entities;
using StudyPlatform.Domain.Interfaces;
using StudyPlatform.Infrastructure.Data;

namespace StudyPlatform.Infrastructure.Repositories;

public class DataExportRequestRepository : Repository<DataExportRequest>, IDataExportRequestRepository
{
    public DataExportRequestRepository(AppDbContext context) : base(context) { }

    public async Task<IReadOnlyList<DataExportRequest>> GetForUserAsync(
        Guid userId, CancellationToken cancellationToken = default)
        => await _dbSet
            .AsNoTracking()
            .Where(r => r.UserId == userId)
            .OrderByDescending(r => r.CreatedAt)
            .ToListAsync(cancellationToken);

    public async Task<DataExportRequest?> GetActiveForUserAsync(
        Guid userId, CancellationToken cancellationToken = default)
        => await _dbSet
            .AsNoTracking()
            .Where(r => r.UserId == userId
                        && (r.Status == DataExportStatus.Pending || r.Status == DataExportStatus.Running))
            .OrderByDescending(r => r.CreatedAt)
            .FirstOrDefaultAsync(cancellationToken);
}
