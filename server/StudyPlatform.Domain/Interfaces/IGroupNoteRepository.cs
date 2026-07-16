using StudyPlatform.Domain.Entities;

namespace StudyPlatform.Domain.Interfaces;

public interface IGroupNoteRepository : IRepository<GroupNote>
{
    Task<IEnumerable<GroupNote>> GetByGroupAsync(Guid groupId, CancellationToken cancellationToken = default);
}
