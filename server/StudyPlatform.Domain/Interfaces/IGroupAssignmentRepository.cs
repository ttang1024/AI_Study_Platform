using StudyPlatform.Domain.Entities;

namespace StudyPlatform.Domain.Interfaces;

public interface IGroupAssignmentRepository : IRepository<GroupAssignment>
{
    Task<IEnumerable<GroupAssignment>> GetByGroupWithCompletionsAsync(Guid groupId, CancellationToken cancellationToken = default);
    Task<GroupAssignment?> GetByIdWithCompletionsAsync(Guid assignmentId, CancellationToken cancellationToken = default);
    Task AddCompletionAsync(GroupAssignmentCompletion completion, CancellationToken cancellationToken = default);
}
