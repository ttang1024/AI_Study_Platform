using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using StudyPlatform.Domain.Entities;

namespace StudyPlatform.Infrastructure.Data.Configurations;

public class StreakCoverDayConfiguration : IEntityTypeConfiguration<StreakCoverDay>
{
    public void Configure(EntityTypeBuilder<StreakCoverDay> builder)
    {
        builder.HasKey(c => c.Id);
        builder.Property(c => c.Type).HasMaxLength(20);
        builder.HasIndex(c => new { c.UserId, c.Date }).IsUnique();
    }
}
