using StudyPlatform.Domain.Entities;

namespace StudyPlatform.Domain.Interfaces;

public interface IStudyGroupRepository : IRepository<StudyGroup>
{
    Task<IEnumerable<StudyGroup>> GetByUserAsync(Guid userId, CancellationToken cancellationToken = default);
    Task<StudyGroup?> GetByInviteCodeAsync(string inviteCode, CancellationToken cancellationToken = default);
    Task<StudyGroup?> GetWithMembersAsync(Guid groupId, CancellationToken cancellationToken = default);
}

public interface IStudyGroupMemberRepository : IRepository<StudyGroupMember>
{
    Task<IEnumerable<StudyGroupMember>> GetByGroupAsync(Guid groupId, CancellationToken cancellationToken = default);
    Task<IEnumerable<StudyGroupMember>> GetByUserAsync(Guid userId, CancellationToken cancellationToken = default);
}

public interface IGroupChatMessageRepository : IRepository<GroupChatMessage>
{
    Task<IEnumerable<GroupChatMessage>> GetByGroupAsync(Guid groupId, int pageSize, DateTime? beforeDate, CancellationToken cancellationToken = default);
}

public interface IStudyGroupSharedCourseRepository : IRepository<StudyGroupSharedCourse>
{
}
