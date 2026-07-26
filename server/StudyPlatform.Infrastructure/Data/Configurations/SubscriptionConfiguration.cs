using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using StudyPlatform.Domain.Entities;

namespace StudyPlatform.Infrastructure.Data.Configurations;

public class SubscriptionConfiguration : IEntityTypeConfiguration<Subscription>
{
    public void Configure(EntityTypeBuilder<Subscription> builder)
    {
        builder.HasKey(s => s.SubscriptionId);

        builder.Property(s => s.PlanKey).IsRequired().HasMaxLength(32);
        builder.Property(s => s.Status).IsRequired().HasMaxLength(32);
        builder.Property(s => s.ExternalCustomerId).HasMaxLength(128);
        builder.Property(s => s.ExternalSubscriptionId).HasMaxLength(128);
        builder.Property(s => s.CreatedAt).IsRequired();
        builder.Property(s => s.UpdatedAt).IsRequired();

        // One subscription per holder. Filtered so the many rows on the other side of each union
        // don't collide on NULL.
        builder.HasIndex(s => s.UserId).IsUnique().HasFilter("\"UserId\" IS NOT NULL");
        builder.HasIndex(s => s.OrganizationId).IsUnique().HasFilter("\"OrganizationId\" IS NOT NULL");
        builder.HasIndex(s => s.ExternalCustomerId);
        builder.HasIndex(s => s.ExternalSubscriptionId);

        builder.HasOne(s => s.User)
            .WithMany()
            .HasForeignKey(s => s.UserId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(s => s.Organization)
            .WithMany()
            .HasForeignKey(s => s.OrganizationId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
