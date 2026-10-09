using StudyPlatform.Domain.Entities;
using StudyPlatform.Domain.Enums;

namespace StudyPlatform.Domain.Interfaces;

public interface IOtpRepository : IRepository<OtpCode>
{
    /// <summary>
    /// The unused, unexpired code for this address and purpose — at most one exists, because sending a
    /// code invalidates the earlier ones. Deliberately not looked up by code value: the caller compares
    /// and counts the guess against this row (see OtpVerifier).
    /// </summary>
    Task<OtpCode?> GetActiveOtpAsync(string email, OtpPurpose purpose, CancellationToken cancellationToken = default);
    Task InvalidateExistingOtpsAsync(string email, OtpPurpose purpose, CancellationToken cancellationToken = default);
}
