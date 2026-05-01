using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using StudyPlatform.Domain.Entities;

namespace StudyPlatform.Infrastructure.Data.Configurations;

public class WorkedProblemConfiguration : IEntityTypeConfiguration<WorkedProblem>
{
    public void Configure(EntityTypeBuilder<WorkedProblem> builder)
    {
        builder.HasKey(p => p.WorkedProblemId);

        builder.HasIndex(p => p.UserId);

        builder.Property(p => p.ProblemText).IsRequired();
        builder.Property(p => p.StepsJson).IsRequired();
        builder.Property(p => p.FinalAnswer).IsRequired();
        builder.Property(p => p.Difficulty).IsRequired().HasMaxLength(20);
        builder.Property(p => p.Topic).HasMaxLength(200);
        builder.Property(p => p.CreatedAt).IsRequired();

        builder.HasOne(p => p.User)
            .WithMany()
            .HasForeignKey(p => p.UserId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasMany(p => p.Attempts)
            .WithOne(a => a.WorkedProblem)
            .HasForeignKey(a => a.WorkedProblemId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
