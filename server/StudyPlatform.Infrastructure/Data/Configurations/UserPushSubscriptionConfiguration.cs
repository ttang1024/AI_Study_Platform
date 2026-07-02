using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using StudyPlatform.Domain.Entities;

namespace StudyPlatform.Infrastructure.Data.Configurations;

public class UserPushSubscriptionConfiguration : IEntityTypeConfiguration<UserPushSubscription>
{
    public void Configure(EntityTypeBuilder<UserPushSubscription> builder)
    {
        builder.HasKey(s => s.UserPushSubscriptionId);
        builder.Property(s => s.Endpoint).IsRequired().HasMaxLength(2048);
        builder.Property(s => s.P256dh).IsRequired().HasMaxLength(512);
        builder.Property(s => s.Auth).IsRequired().HasMaxLength(512);

        builder.HasIndex(s => s.Endpoint).IsUnique();
        builder.HasIndex(s => s.UserId);

        builder.HasOne(s => s.User)
            .WithMany()
            .HasForeignKey(s => s.UserId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
