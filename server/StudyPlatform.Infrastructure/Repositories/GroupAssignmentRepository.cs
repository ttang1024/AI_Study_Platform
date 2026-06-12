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

    // Completions must be added through the DbSet, not a tracked assignment's
    // navigation collection: their Guid key is pre-set, so DetectChanges would
    // classify a navigation-discovered completion as Modified and issue an
    // UPDATE that matches no row (DbUpdateConcurrencyException).
    public async Task AddCompletionAsync(GroupAssignmentCompletion completion, CancellationToken cancellationToken = default)
        => await _context.GroupAssignmentCompletions.AddAsync(completion, cancellationToken);
}
