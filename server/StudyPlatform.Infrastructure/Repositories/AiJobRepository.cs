using Microsoft.EntityFrameworkCore;
using StudyPlatform.Domain.Entities;
using StudyPlatform.Domain.Interfaces;
using StudyPlatform.Infrastructure.Data;

namespace StudyPlatform.Infrastructure.Repositories;

public class AiJobRepository : Repository<AiJob>, IAiJobRepository
{
    public AiJobRepository(AppDbContext context) : base(context) { }

    public async Task<AiJob?> GetActiveAsync(
        Guid userId, Guid documentId, string jobType, CancellationToken cancellationToken = default)
        => await _dbSet
            .Where(j => j.UserId == userId
                        && j.DocumentId == documentId
                        && j.JobType == jobType
                        && (j.Status == AiJobStatus.Queued || j.Status == AiJobStatus.Running))
            .OrderByDescending(j => j.CreatedAt)
            .FirstOrDefaultAsync(cancellationToken);

    public async Task<int> FailInterruptedAsync(string reason, CancellationToken cancellationToken = default)
        => await _dbSet
            .Where(j => j.Status == AiJobStatus.Queued || j.Status == AiJobStatus.Running)
            .ExecuteUpdateAsync(
                s => s
                    .SetProperty(j => j.Status, AiJobStatus.Failed)
                    .SetProperty(j => j.Error, reason)
                    .SetProperty(j => j.CompletedAt, DateTime.UtcNow),
                cancellationToken);
}
