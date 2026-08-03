using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using StudyPlatform.Domain.Entities;

namespace StudyPlatform.Infrastructure.Data.Configurations;

public class ApiKeyConfiguration : IEntityTypeConfiguration<ApiKey>
{
    public void Configure(EntityTypeBuilder<ApiKey> builder)
    {
        builder.HasKey(k => k.ApiKeyId);

        builder.Property(k => k.Name).IsRequired().HasMaxLength(64);
        builder.Property(k => k.KeyHash).IsRequired().HasMaxLength(64);
        builder.Property(k => k.Prefix).IsRequired().HasMaxLength(24);
        builder.Property(k => k.Scopes).IsRequired().HasMaxLength(512);
        builder.Property(k => k.CreatedAt).IsRequired();

        // Unique, and the lookup that authenticates every API-key request — so it has to be a point
        // lookup on an index, never a scan.
        builder.HasIndex(k => k.KeyHash).IsUnique();
        builder.HasIndex(k => k.UserId);

        builder.HasOne(k => k.User)
            .WithMany()
            .HasForeignKey(k => k.UserId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}

public class WebhookConfiguration : IEntityTypeConfiguration<Webhook>
{
    public void Configure(EntityTypeBuilder<Webhook> builder)
    {
        builder.HasKey(w => w.WebhookId);

        builder.Property(w => w.Url).IsRequired().HasMaxLength(2048);
        builder.Property(w => w.Secret).IsRequired().HasMaxLength(128);
        builder.Property(w => w.Events).IsRequired().HasMaxLength(512);
        builder.Property(w => w.CreatedAt).IsRequired();

        // Dispatch reads a user's active endpoints on every event, so both columns are in the index.
        builder.HasIndex(w => new { w.UserId, w.IsActive });

        builder.HasOne(w => w.User)
            .WithMany()
            .HasForeignKey(w => w.UserId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
