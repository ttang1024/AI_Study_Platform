using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using StudyPlatform.Domain.Entities;

namespace StudyPlatform.Infrastructure.Data.Configurations;

public class ExamPlanConfiguration : IEntityTypeConfiguration<ExamPlan>
{
    public void Configure(EntityTypeBuilder<ExamPlan> builder)
    {
        builder.HasKey(p => p.ExamPlanId);
        builder.Property(p => p.Title).IsRequired().HasMaxLength(200);
        builder.Property(p => p.ExamDate).IsRequired();

        builder.HasIndex(p => new { p.UserId, p.ExamDate });

        builder.HasOne(p => p.User)
            .WithMany()
            .HasForeignKey(p => p.UserId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(p => p.Course)
            .WithMany()
            .HasForeignKey(p => p.CourseId)
            .OnDelete(DeleteBehavior.SetNull);
    }
}
