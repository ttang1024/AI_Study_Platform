using Microsoft.EntityFrameworkCore;
using StudyPlatform.Domain.Entities;
using StudyPlatform.Domain.Interfaces;
using StudyPlatform.Infrastructure.Data;

namespace StudyPlatform.Infrastructure.Repositories;

public class RubricRepository : Repository<Rubric>, IRubricRepository
{
    public RubricRepository(AppDbContext context) : base(context) { }

    public async Task<IEnumerable<Rubric>> GetByUserAsync(Guid userId, CancellationToken cancellationToken = default)
        => await _dbSet
            .AsNoTracking()
            .Where(r => r.UserId == userId)
            .OrderByDescending(r => r.UpdatedAt)
            .ToListAsync(cancellationToken);
}

public class EssaySubmissionRepository : Repository<EssaySubmission>, IEssaySubmissionRepository
{
    public EssaySubmissionRepository(AppDbContext context) : base(context) { }

    public async Task<IEnumerable<EssaySubmission>> GetLatestByUserAsync(
        Guid userId, CancellationToken cancellationToken = default)
    {
        // The head of a chain is the draft nothing else revises. Computed as a set difference rather
        // than a per-row EXISTS so the whole list costs two scans instead of one query per essay.
        var all = await _dbSet
            .AsNoTracking()
            .Where(e => e.UserId == userId)
            .ToListAsync(cancellationToken);

        var supersededIds = all
            .Where(e => e.ParentSubmissionId != null)
            .Select(e => e.ParentSubmissionId!.Value)
            .ToHashSet();

        return all
            .Where(e => !supersededIds.Contains(e.EssaySubmissionId))
            .OrderByDescending(e => e.UpdatedAt)
            .ToList();
    }

    public async Task<IEnumerable<EssaySubmission>> GetRevisionChainAsync(
        Guid userId, Guid submissionId, CancellationToken cancellationToken = default)
    {
        var all = await _dbSet
            .AsNoTracking()
            .Where(e => e.UserId == userId)
            .ToListAsync(cancellationToken);

        var byId = all.ToDictionary(e => e.EssaySubmissionId);
        if (!byId.TryGetValue(submissionId, out var current))
            return Array.Empty<EssaySubmission>();

        // Walk back to the first draft, then return oldest-first so the UI reads as a history.
        var chain = new List<EssaySubmission> { current };
        var guard = 0;
        while (current.ParentSubmissionId is { } parentId
               && byId.TryGetValue(parentId, out var parent)
               && guard++ < 100)
        {
            chain.Add(parent);
            current = parent;
        }

        chain.Reverse();
        return chain;
    }
}
