using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using StudyPlatform.Domain.Entities;

namespace StudyPlatform.Infrastructure.Data.Configurations;

public class RubricConfiguration : IEntityTypeConfiguration<Rubric>
{
    public void Configure(EntityTypeBuilder<Rubric> builder)
    {
        builder.HasKey(r => r.RubricId);

        builder.Property(r => r.Name).IsRequired().HasMaxLength(200);
        builder.Property(r => r.Description).HasMaxLength(2000);
        builder.Property(r => r.CriteriaJson).IsRequired();
        builder.Property(r => r.CreatedAt).IsRequired();
        builder.Property(r => r.UpdatedAt).IsRequired();

        builder.HasIndex(r => r.UserId);

        builder.HasOne(r => r.User)
            .WithMany()
            .HasForeignKey(r => r.UserId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}

public class EssaySubmissionConfiguration : IEntityTypeConfiguration<EssaySubmission>
{
    public void Configure(EntityTypeBuilder<EssaySubmission> builder)
    {
        builder.HasKey(e => e.EssaySubmissionId);

        builder.Property(e => e.Title).IsRequired().HasMaxLength(300);
        builder.Property(e => e.Text).IsRequired();
        builder.Property(e => e.CreatedAt).IsRequired();
        builder.Property(e => e.UpdatedAt).IsRequired();

        builder.HasIndex(e => e.UserId);
        builder.HasIndex(e => e.ParentSubmissionId);

        builder.HasOne(e => e.User)
            .WithMany()
            .HasForeignKey(e => e.UserId)
            .OnDelete(DeleteBehavior.Cascade);

        // Deleting a rubric must not delete the work graded against it; the feedback stays readable.
        builder.HasOne(e => e.Rubric)
            .WithMany()
            .HasForeignKey(e => e.RubricId)
            .OnDelete(DeleteBehavior.SetNull);
    }
}
