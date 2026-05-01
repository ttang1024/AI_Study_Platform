using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using StudyPlatform.Domain.Entities;

namespace StudyPlatform.Infrastructure.Data.Configurations;

public class OtpCodeConfiguration : IEntityTypeConfiguration<OtpCode>
{
    public void Configure(EntityTypeBuilder<OtpCode> builder)
    {
        builder.HasKey(o => o.OtpId);
        builder.Property(o => o.Email).IsRequired().HasMaxLength(256);
        builder.Property(o => o.Code).IsRequired().HasMaxLength(10);
        builder.Property(o => o.Purpose).IsRequired();
        builder.Property(o => o.IsUsed).HasDefaultValue(false);
        builder.Property(o => o.ExpiresAt).IsRequired();
        builder.Property(o => o.CreatedAt).IsRequired();

        builder.Property(o => o.UserId).IsRequired(false);

        builder.HasOne(o => o.User)
            .WithMany(u => u.OtpCodes)
            .HasForeignKey(o => o.UserId)
            .IsRequired(false)
            .OnDelete(DeleteBehavior.SetNull);

        builder.HasIndex(o => new { o.Email, o.Purpose });
        builder.HasIndex(o => o.ExpiresAt);
    }
}
