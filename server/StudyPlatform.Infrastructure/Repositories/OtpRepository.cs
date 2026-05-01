using Microsoft.EntityFrameworkCore;
using StudyPlatform.Domain.Entities;
using StudyPlatform.Domain.Enums;
using StudyPlatform.Domain.Interfaces;
using StudyPlatform.Infrastructure.Data;

namespace StudyPlatform.Infrastructure.Repositories;

public class OtpRepository : Repository<OtpCode>, IOtpRepository
{
    public OtpRepository(AppDbContext context) : base(context) { }

    public async Task<OtpCode?> GetValidOtpAsync(string email, string code, OtpPurpose purpose, CancellationToken cancellationToken = default)
        => await _dbSet.FirstOrDefaultAsync(o =>
            o.Email == email &&
            o.Code == code &&
            o.Purpose == purpose &&
            !o.IsUsed &&
            o.ExpiresAt > DateTime.UtcNow,
            cancellationToken);

    public async Task InvalidateExistingOtpsAsync(string email, OtpPurpose purpose, CancellationToken cancellationToken = default)
    {
        var otps = await _dbSet
            .Where(o => o.Email == email && o.Purpose == purpose && !o.IsUsed)
            .ToListAsync(cancellationToken);

        foreach (var otp in otps)
            otp.IsUsed = true;
    }
}
