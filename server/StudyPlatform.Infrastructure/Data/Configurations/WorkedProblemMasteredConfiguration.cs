using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using StudyPlatform.Domain.Entities;

namespace StudyPlatform.Infrastructure.Data.Configurations;

public class WorkedProblemMasteredConfiguration : IEntityTypeConfiguration<WorkedProblemMastered>
{
    public void Configure(EntityTypeBuilder<WorkedProblemMastered> builder)
    {
        builder.HasKey(m => m.Id);

        builder.HasIndex(m => new { m.UserId, m.WorkedProblemId }).IsUnique();

        builder.Property(m => m.MasteredAt).IsRequired();

        builder.HasOne(m => m.WorkedProblem)
            .WithMany()
            .HasForeignKey(m => m.WorkedProblemId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
