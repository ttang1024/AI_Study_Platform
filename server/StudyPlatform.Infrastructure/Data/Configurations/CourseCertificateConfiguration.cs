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

public class EssayPeerReviewConfiguration : IEntityTypeConfiguration<EssayPeerReview>
{
    public void Configure(EntityTypeBuilder<EssayPeerReview> builder)
    {
        builder.HasKey(r => r.EssayPeerReviewId);

        builder.Property(r => r.Status).IsRequired().HasMaxLength(16);
        builder.Property(r => r.OverallComment).HasMaxLength(4000);
        builder.Property(r => r.AssignedAt).IsRequired();

        // One assignment per reviewer per draft, enforced in the schema so a retried request cannot
        // ask the same classmate twice.
        builder.HasIndex(r => new { r.EssaySubmissionId, r.ReviewerUserId }).IsUnique();

        // The reviewer's queue: their rows, filtered by status.
        builder.HasIndex(r => new { r.ReviewerUserId, r.Status });

        builder.HasOne(r => r.Submission)
            .WithMany()
            .HasForeignKey(r => r.EssaySubmissionId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(r => r.Reviewer)
            .WithMany()
            .HasForeignKey(r => r.ReviewerUserId)
            // Restrict, not cascade: a reviewer's account going away must not silently delete the
            // feedback an author already received and may be working from.
            .OnDelete(DeleteBehavior.Restrict);
    }
}
