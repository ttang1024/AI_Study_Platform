using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using StudyPlatform.Domain.Entities;

namespace StudyPlatform.Infrastructure.Data.Configurations;

public class UserTwoFactorConfiguration : IEntityTypeConfiguration<UserTwoFactor>
{
    public void Configure(EntityTypeBuilder<UserTwoFactor> builder)
    {
        // The user id is the key, which is what makes "one factor per user" a schema guarantee
        // rather than something every write path has to remember.
        builder.HasKey(f => f.UserId);

        builder.Property(f => f.SecretBase32).IsRequired().HasMaxLength(64);
        builder.Property(f => f.RecoveryCodeHashesJson).IsRequired();
        builder.Property(f => f.CreatedAt).IsRequired();
        builder.Property(f => f.UpdatedAt).IsRequired();

        builder.HasOne(f => f.User)
            .WithOne()
            .HasForeignKey<UserTwoFactor>(f => f.UserId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
