using StudyPlatform.Domain.Entities;
using StudyPlatform.Domain.Enums;

namespace StudyPlatform.Domain.Interfaces;

public interface IOtpRepository : IRepository<OtpCode>
{
    Task<OtpCode?> GetValidOtpAsync(string email, string code, OtpPurpose purpose, CancellationToken cancellationToken = default);
    Task InvalidateExistingOtpsAsync(string email, OtpPurpose purpose, CancellationToken cancellationToken = default);
}
