using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using StudyPlatform.Domain.Entities;

namespace StudyPlatform.Infrastructure.Data.Configurations;

public class FeedbackConfiguration : IEntityTypeConfiguration<Feedback>
{
    public void Configure(EntityTypeBuilder<Feedback> builder)
    {
        builder.HasKey(f => f.Id);
        builder.Property(f => f.Type).IsRequired().HasMaxLength(20);
        builder.Property(f => f.Status).IsRequired().HasMaxLength(20).HasDefaultValue("new");
        builder.Property(f => f.Subject).IsRequired().HasMaxLength(200);
        builder.Property(f => f.Message).IsRequired();
        builder.Property(f => f.UserEmail).HasMaxLength(256);
        builder.Property(f => f.SubmittedAt).IsRequired();
        builder.HasIndex(f => f.Status);
        builder.HasIndex(f => f.SubmittedAt);
    }
}
