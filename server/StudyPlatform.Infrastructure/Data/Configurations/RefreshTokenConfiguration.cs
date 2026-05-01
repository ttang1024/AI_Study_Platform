using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using StudyPlatform.Domain.Entities;

namespace StudyPlatform.Infrastructure.Data.Configurations;

public class RefreshTokenConfiguration : IEntityTypeConfiguration<RefreshToken>
{
    public void Configure(EntityTypeBuilder<RefreshToken> builder)
    {
        builder.HasKey(r => r.TokenId);
        builder.Property(r => r.Token).IsRequired().HasMaxLength(500);
        builder.Property(r => r.ExpiresAt).IsRequired();
        builder.Property(r => r.IsRevoked).HasDefaultValue(false);
        builder.Property(r => r.CreatedAt).IsRequired();
        builder.HasIndex(r => r.Token).IsUnique();
        builder.HasIndex(r => new { r.UserId, r.IsRevoked, r.ExpiresAt });

        builder.HasOne(r => r.User)
            .WithMany(u => u.RefreshTokens)
            .HasForeignKey(r => r.UserId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
