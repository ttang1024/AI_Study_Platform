using Microsoft.EntityFrameworkCore;
using StudyPlatform.Domain.Entities;
using StudyPlatform.Domain.Interfaces;
using StudyPlatform.Infrastructure.Data;

namespace StudyPlatform.Infrastructure.Repositories;

public class GroupAssignmentRepository : Repository<GroupAssignment>, IGroupAssignmentRepository
{
    private readonly AppDbContext _context;

    public GroupAssignmentRepository(AppDbContext context) : base(context)
    {
        _context = context;
    }

    public async Task<IEnumerable<GroupAssignment>> GetByGroupWithCompletionsAsync(Guid groupId, CancellationToken cancellationToken = default)
        => await _context.GroupAssignments
            .AsNoTracking()
            .Include(a => a.Completions).ThenInclude(c => c.User)
            .Where(a => a.GroupId == groupId)
            .OrderByDescending(a => a.CreatedAt)
            .ToListAsync(cancellationToken);

    public async Task<GroupAssignment?> GetByIdWithCompletionsAsync(Guid assignmentId, CancellationToken cancellationToken = default)
        => await _context.GroupAssignments
            .Include(a => a.Completions)
            .FirstOrDefaultAsync(a => a.GroupAssignmentId == assignmentId, cancellationToken);
}
