using Microsoft.EntityFrameworkCore;
using StudyPlatform.Domain.Entities;
using StudyPlatform.Domain.Interfaces;
using StudyPlatform.Infrastructure.Data;

namespace StudyPlatform.Infrastructure.Repositories;

public class StudyGroupRepository : Repository<StudyGroup>, IStudyGroupRepository
{
    public StudyGroupRepository(AppDbContext context) : base(context) { }

    public async Task<IEnumerable<StudyGroup>> GetByUserAsync(Guid userId, CancellationToken cancellationToken = default)
        => await _dbSet
            .Include(g => g.Members)
            .Include(g => g.SharedCourses)
            .Where(g => g.Members.Any(m => m.UserId == userId))
            .OrderByDescending(g => g.CreatedAt)
            .ToListAsync(cancellationToken);

    public async Task<StudyGroup?> GetByInviteCodeAsync(string inviteCode, CancellationToken cancellationToken = default)
        => await _dbSet
            .Include(g => g.Members)
            .FirstOrDefaultAsync(g => g.InviteCode == inviteCode, cancellationToken);

    public async Task<StudyGroup?> GetWithMembersAsync(Guid groupId, CancellationToken cancellationToken = default)
        => await _dbSet
            .Include(g => g.Members).ThenInclude(m => m.User)
            .Include(g => g.SharedCourses).ThenInclude(sc => sc.Course)
            .Include(g => g.SharedCourses).ThenInclude(sc => sc.SharedBy)
            .FirstOrDefaultAsync(g => g.StudyGroupId == groupId, cancellationToken);
}

public class StudyGroupMemberRepository : Repository<StudyGroupMember>, IStudyGroupMemberRepository
{
    public StudyGroupMemberRepository(AppDbContext context) : base(context) { }

    public async Task<IEnumerable<StudyGroupMember>> GetByGroupAsync(Guid groupId, CancellationToken cancellationToken = default)
        => await _dbSet
            .Include(m => m.User)
            .Where(m => m.GroupId == groupId)
            .ToListAsync(cancellationToken);

    public async Task<IEnumerable<StudyGroupMember>> GetByUserAsync(Guid userId, CancellationToken cancellationToken = default)
        => await _dbSet
            .Where(m => m.UserId == userId)
            .ToListAsync(cancellationToken);
}

public class StudyGroupSharedCourseRepository : Repository<StudyGroupSharedCourse>, IStudyGroupSharedCourseRepository
{
    public StudyGroupSharedCourseRepository(AppDbContext context) : base(context) { }
}

public class GroupChatMessageRepository : Repository<GroupChatMessage>, IGroupChatMessageRepository
{
    public GroupChatMessageRepository(AppDbContext context) : base(context) { }

    public async Task<IEnumerable<GroupChatMessage>> GetByGroupAsync(Guid groupId, int pageSize, DateTime? beforeDate, CancellationToken cancellationToken = default)
    {
        var query = _dbSet
            .Include(m => m.User)
            .Where(m => m.GroupId == groupId);

        if (beforeDate.HasValue)
            query = query.Where(m => m.SentAt < beforeDate.Value);

        return await query
            .OrderByDescending(m => m.SentAt)
            .Take(pageSize)
            .OrderBy(m => m.SentAt)
            .ToListAsync(cancellationToken);
    }
}
