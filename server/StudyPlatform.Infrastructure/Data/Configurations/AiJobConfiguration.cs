using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using StudyPlatform.Domain.Entities;

namespace StudyPlatform.Infrastructure.Data.Configurations;

public class AiJobConfiguration : IEntityTypeConfiguration<AiJob>
{
    public void Configure(EntityTypeBuilder<AiJob> builder)
    {
        builder.HasKey(j => j.AiJobId);
        builder.Property(j => j.JobType).IsRequired().HasMaxLength(30);
        builder.Property(j => j.Status).IsRequired().HasMaxLength(20);
        builder.Property(j => j.Difficulty).HasMaxLength(20);
        builder.Property(j => j.Error).HasMaxLength(2000);

        // The client polls "is there already a job running for this artifact?" before starting another.
        builder.HasIndex(j => new { j.UserId, j.DocumentId, j.JobType, j.Status });

        // Startup sweeps for jobs orphaned by a restart.
        builder.HasIndex(j => j.Status);

        builder.HasOne(j => j.User)
            .WithMany()
            .HasForeignKey(j => j.UserId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(j => j.Document)
            .WithMany()
            .HasForeignKey(j => j.DocumentId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
