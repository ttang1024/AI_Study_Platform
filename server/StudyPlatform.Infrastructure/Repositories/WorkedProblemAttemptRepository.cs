using Microsoft.EntityFrameworkCore;
using StudyPlatform.Domain.Entities;
using StudyPlatform.Domain.Interfaces;
using StudyPlatform.Infrastructure.Data;

namespace StudyPlatform.Infrastructure.Repositories;

public class WorkedProblemAttemptRepository : IWorkedProblemAttemptRepository
{
    private readonly AppDbContext _context;

    public WorkedProblemAttemptRepository(AppDbContext context)
    {
        _context = context;
    }

    public async Task<IEnumerable<WorkedProblemAttempt>> GetByProblemAsync(Guid problemId, Guid userId, CancellationToken cancellationToken = default)
        => await _context.WorkedProblemAttempts
            .Where(a => a.WorkedProblemId == problemId && a.UserId == userId)
            .OrderByDescending(a => a.AttemptedAt)
            .ToListAsync(cancellationToken);

    public async Task AddAsync(WorkedProblemAttempt attempt, CancellationToken cancellationToken = default)
        => await _context.WorkedProblemAttempts.AddAsync(attempt, cancellationToken);
}
