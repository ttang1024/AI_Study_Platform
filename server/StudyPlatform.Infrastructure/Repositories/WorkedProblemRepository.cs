using Microsoft.EntityFrameworkCore;
using StudyPlatform.Domain.Entities;
using StudyPlatform.Domain.Interfaces;
using StudyPlatform.Infrastructure.Data;

namespace StudyPlatform.Infrastructure.Repositories;

public class WorkedProblemRepository : IWorkedProblemRepository
{
    private readonly AppDbContext _context;

    public WorkedProblemRepository(AppDbContext context)
    {
        _context = context;
    }

    public async Task<IEnumerable<WorkedProblem>> GetByUserAsync(Guid userId, Guid? documentId, Guid? videoId, CancellationToken cancellationToken = default)
    {
        var query = _context.WorkedProblems.Where(p => p.UserId == userId);
        if (documentId.HasValue)
            query = query.Where(p => p.DocumentId == documentId);
        else if (videoId.HasValue)
            query = query.Where(p => p.YouTubeVideoId == videoId);
        return await query.OrderByDescending(p => p.CreatedAt).ToListAsync(cancellationToken);
    }

    public async Task<WorkedProblem?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default)
        => await _context.WorkedProblems
            .Include(p => p.Attempts)
            .FirstOrDefaultAsync(p => p.WorkedProblemId == id, cancellationToken);

    public async Task AddAsync(WorkedProblem problem, CancellationToken cancellationToken = default)
        => await _context.WorkedProblems.AddAsync(problem, cancellationToken);

    public async Task AddRangeAsync(IEnumerable<WorkedProblem> problems, CancellationToken cancellationToken = default)
        => await _context.WorkedProblems.AddRangeAsync(problems, cancellationToken);
}
