using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using StudyPlatform.Domain.Entities;

namespace StudyPlatform.Infrastructure.Data.Configurations;

public class AiUsageLogConfiguration : IEntityTypeConfiguration<AiUsageLog>
{
    public void Configure(EntityTypeBuilder<AiUsageLog> builder)
    {
        builder.HasKey(u => u.AiUsageLogId);
        builder.Property(u => u.Provider).IsRequired().HasMaxLength(40);
        builder.Property(u => u.Model).IsRequired().HasMaxLength(120);
        builder.Property(u => u.Operation).IsRequired().HasMaxLength(80);
        builder.Property(u => u.EstimatedCostUsd).HasPrecision(12, 6);

        // The quota check sums a user's tokens since midnight on every AI call, so it has to be an index seek.
        builder.HasIndex(u => new { u.UserId, u.CreatedAt });

        builder.HasOne(u => u.User)
            .WithMany()
            .HasForeignKey(u => u.UserId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
