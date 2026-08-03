using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using StudyPlatform.Domain.Entities;

namespace StudyPlatform.Infrastructure.Data.Configurations;

public class AuditLogEntryConfiguration : IEntityTypeConfiguration<AuditLogEntry>
{
    public void Configure(EntityTypeBuilder<AuditLogEntry> builder)
    {
        builder.HasKey(e => e.AuditLogEntryId);

        builder.Property(e => e.Action).IsRequired().HasMaxLength(64);
        builder.Property(e => e.TargetType).HasMaxLength(64);
        builder.Property(e => e.TargetId).HasMaxLength(64);
        builder.Property(e => e.IpAddress).HasMaxLength(64);
        builder.Property(e => e.UserAgent).HasMaxLength(512);
        builder.Property(e => e.CreatedAt).IsRequired();

        // Both read paths are "newest first for a person", so the time column is part of each index
        // rather than left to a sort over the match set.
        builder.HasIndex(e => new { e.ActorUserId, e.CreatedAt });
        builder.HasIndex(e => new { e.SubjectUserId, e.CreatedAt });
        builder.HasIndex(e => new { e.Action, e.CreatedAt });

        // No FK to User. Entries outlive the account they describe — deletion anonymises them in
        // place — and a constraint would force them to be destroyed with it.
    }
}
