using Microsoft.EntityFrameworkCore;
using StudyPlatform.Domain.Entities;
using StudyPlatform.Domain.Interfaces;
using StudyPlatform.Infrastructure.Data;

namespace StudyPlatform.Infrastructure.Repositories;

public class GroupNoteRepository : Repository<GroupNote>, IGroupNoteRepository
{
    public GroupNoteRepository(AppDbContext context) : base(context) { }

    public async Task<IEnumerable<GroupNote>> GetByGroupAsync(Guid groupId, CancellationToken ct = default)
        => await _dbSet
            .Where(n => n.GroupId == groupId)
            .OrderByDescending(n => n.UpdatedAt)
            .ToListAsync(ct);
}
