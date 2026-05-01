using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using StudyPlatform.Domain.Entities;

namespace StudyPlatform.Infrastructure.Data.Configurations;

public class WorkedProblemAttemptConfiguration : IEntityTypeConfiguration<WorkedProblemAttempt>
{
    public void Configure(EntityTypeBuilder<WorkedProblemAttempt> builder)
    {
        builder.HasKey(a => a.WorkedProblemAttemptId);

        builder.HasIndex(a => a.WorkedProblemId);

        builder.Property(a => a.UserAnswer).IsRequired();
        builder.Property(a => a.AttemptedAt).IsRequired();

        builder.HasOne(a => a.User)
            .WithMany()
            .HasForeignKey(a => a.UserId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}
