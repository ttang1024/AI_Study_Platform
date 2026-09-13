using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using StudyPlatform.Domain.Entities;

namespace StudyPlatform.Infrastructure.Data.Configurations;

public class UserFsrsSettingsConfiguration : IEntityTypeConfiguration<UserFsrsSettings>
{
    public void Configure(EntityTypeBuilder<UserFsrsSettings> builder)
    {
        builder.HasKey(s => s.Id);
        builder.HasIndex(s => s.UserId).IsUnique();
        builder.Property(s => s.WeightsJson).HasMaxLength(2000);
    }
}
