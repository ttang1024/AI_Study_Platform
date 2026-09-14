using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using StudyPlatform.Domain.Entities;

namespace StudyPlatform.Infrastructure.Data.Configurations;

public class CourseCertificateConfiguration : IEntityTypeConfiguration<CourseCertificate>
{
    public void Configure(EntityTypeBuilder<CourseCertificate> builder)
    {
        builder.HasKey(c => c.CourseCertificateId);

        builder.Property(c => c.CourseName).IsRequired().HasMaxLength(256);
        builder.Property(c => c.RecipientName).IsRequired().HasMaxLength(256);
        builder.Property(c => c.PublicToken).IsRequired().HasMaxLength(64);
        builder.Property(c => c.IssuedAt).IsRequired();

        builder.HasIndex(c => c.PublicToken).IsUnique();
        builder.HasIndex(c => new { c.UserId, c.CourseId });

        builder.HasOne(c => c.User)
            .WithMany()
            .HasForeignKey(c => c.UserId)
            .OnDelete(DeleteBehavior.Cascade);

        // No FK to Course. The certificate snapshots what it needs, and deleting a course should not
        // destroy the record that it was once completed.
    }
}
