using StudyPlatform.Domain.Entities;

namespace StudyPlatform.Domain.Interfaces;

public interface IShareTokenRepository : IRepository<ShareToken>
{
    Task<ShareToken?> GetByTokenAsync(string token, CancellationToken cancellationToken = default);
}
