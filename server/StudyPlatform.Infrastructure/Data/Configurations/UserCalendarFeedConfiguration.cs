using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using StudyPlatform.Domain.Entities;

namespace StudyPlatform.Infrastructure.Data.Configurations;

public class UserCalendarFeedConfiguration : IEntityTypeConfiguration<UserCalendarFeed>
{
    public void Configure(EntityTypeBuilder<UserCalendarFeed> builder)
    {
        builder.HasKey(f => f.Id);
        builder.Property(f => f.Name).HasMaxLength(200);
        builder.Property(f => f.Url).HasMaxLength(2000);
        builder.HasIndex(f => f.UserId);
    }
}
