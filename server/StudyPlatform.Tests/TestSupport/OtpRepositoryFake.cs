using Moq;
using StudyPlatform.Domain.Entities;
using StudyPlatform.Domain.Interfaces;

namespace StudyPlatform.Tests.TestSupport;

/// <summary>
/// Gives a mocked <see cref="IOtpRepository"/> the semantics of its two conditional UPDATEs, applied to
/// the in-memory rows, so handler tests can assert on <see cref="OtpCode"/> state as before.
/// </summary>
public static class OtpRepositoryFake
{
    public static Mock<IOtpRepository> WithAtomicOps(this Mock<IOtpRepository> mock, params OtpCode[] rows)
    {
        OtpCode? Find(Guid id) => rows.FirstOrDefault(r => r.OtpId == id);

        mock.Setup(r => r.TryCountAttemptAsync(It.IsAny<Guid>(), It.IsAny<int>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((Guid id, int max, CancellationToken _) =>
            {
                var row = Find(id);
                if (row == null || row.IsUsed || row.FailedAttempts >= max || row.ExpiresAt <= DateTime.UtcNow)
                    return false;
                row.FailedAttempts++;
                return true;
            });
        mock.Setup(r => r.TryMarkUsedAsync(It.IsAny<Guid>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((Guid id, CancellationToken _) =>
            {
                var row = Find(id);
                if (row == null || row.IsUsed)
                    return false;
                row.IsUsed = true;
                return true;
            });
        return mock;
    }
}
