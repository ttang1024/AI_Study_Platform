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
}
