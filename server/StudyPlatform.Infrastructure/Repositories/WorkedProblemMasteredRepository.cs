using Microsoft.EntityFrameworkCore;
using StudyPlatform.Domain.Entities;
using StudyPlatform.Domain.Interfaces;
using StudyPlatform.Infrastructure.Data;

namespace StudyPlatform.Infrastructure.Repositories;

public class WorkedProblemMasteredRepository : IWorkedProblemMasteredRepository
{
    private readonly AppDbContext _context;

    public WorkedProblemMasteredRepository(AppDbContext context)
    {
        _context = context;
    }

    public async Task<IEnumerable<Guid>> GetMasteredProblemIdsByUserAsync(Guid userId, CancellationToken cancellationToken = default)
        => await _context.WorkedProblemMastered
            .Where(m => m.UserId == userId)
            .Select(m => m.WorkedProblemId)
            .ToListAsync(cancellationToken);

    public async Task<WorkedProblemMastered?> GetByUserAndProblemAsync(Guid userId, Guid problemId, CancellationToken cancellationToken = default)
        => await _context.WorkedProblemMastered
            .FirstOrDefaultAsync(m => m.UserId == userId && m.WorkedProblemId == problemId, cancellationToken);

    public async Task AddAsync(WorkedProblemMastered mastered, CancellationToken cancellationToken = default)
        => await _context.WorkedProblemMastered.AddAsync(mastered, cancellationToken);

    public void Remove(WorkedProblemMastered mastered)
        => _context.WorkedProblemMastered.Remove(mastered);
}
