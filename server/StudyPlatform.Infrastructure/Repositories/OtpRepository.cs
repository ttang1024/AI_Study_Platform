using Microsoft.EntityFrameworkCore;
using StudyPlatform.Domain.Entities;
using StudyPlatform.Domain.Enums;
using StudyPlatform.Domain.Interfaces;
using StudyPlatform.Infrastructure.Data;

namespace StudyPlatform.Infrastructure.Repositories;

public class OtpRepository : Repository<OtpCode>, IOtpRepository
{
    public OtpRepository(AppDbContext context) : base(context) { }

    public async Task<OtpCode?> GetActiveOtpAsync(string email, OtpPurpose purpose, CancellationToken cancellationToken = default)
        => await _dbSet
            .Where(o =>
                o.Email == email &&
                o.Purpose == purpose &&
                !o.IsUsed &&
                o.ExpiresAt > DateTime.UtcNow)
            .OrderByDescending(o => o.CreatedAt)
            .FirstOrDefaultAsync(cancellationToken);

    public async Task InvalidateExistingOtpsAsync(string email, OtpPurpose purpose, CancellationToken cancellationToken = default)
    {
        var otps = await _dbSet
            .Where(o => o.Email == email && o.Purpose == purpose && !o.IsUsed)
            .ToListAsync(cancellationToken);

        foreach (var otp in otps)
            otp.IsUsed = true;
    }

    public async Task<bool> TryCountAttemptAsync(Guid otpId, int maxAttempts, CancellationToken cancellationToken = default)
        => await _dbSet
            .Where(o => o.OtpId == otpId && !o.IsUsed && o.FailedAttempts < maxAttempts && o.ExpiresAt > DateTime.UtcNow)
            .ExecuteUpdateAsync(s => s.SetProperty(o => o.FailedAttempts, o => o.FailedAttempts + 1), cancellationToken) == 1;

    public async Task<bool> TryMarkUsedAsync(Guid otpId, CancellationToken cancellationToken = default)
        => await _dbSet
            .Where(o => o.OtpId == otpId && !o.IsUsed)
            .ExecuteUpdateAsync(s => s.SetProperty(o => o.IsUsed, true), cancellationToken) == 1;
}
