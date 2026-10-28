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

    /// <summary>
    /// Counts one guess against the code in a single conditional UPDATE, true only while it is unused,
    /// unexpired and under <paramref name="maxAttempts"/>. Atomic on purpose: a counter read, incremented
    /// and saved by each request let parallel guesses all read the same count, so the cap never held.
    /// </summary>
    Task<bool> TryCountAttemptAsync(Guid otpId, int maxAttempts, CancellationToken cancellationToken = default);

    /// <summary>Marks the code used, true only for the one caller that flipped it.</summary>
    Task<bool> TryMarkUsedAsync(Guid otpId, CancellationToken cancellationToken = default);
}
