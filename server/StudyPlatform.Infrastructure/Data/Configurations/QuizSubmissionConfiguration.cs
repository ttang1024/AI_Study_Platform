using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using StudyPlatform.Domain.Entities;

namespace StudyPlatform.Infrastructure.Data.Configurations;

public class QuizSubmissionConfiguration : IEntityTypeConfiguration<QuizSubmission>
{
    public void Configure(EntityTypeBuilder<QuizSubmission> builder)
    {
        builder.HasKey(s => s.SubmissionId);
        builder.Property(s => s.AnswersJson).IsRequired().HasColumnType("jsonb");
        builder.Property(s => s.SourceType).IsRequired().HasMaxLength(20).HasDefaultValue("document");
        builder.Property(s => s.Score).IsRequired();
        builder.Property(s => s.Total).IsRequired();
        builder.Property(s => s.SubmittedAt).IsRequired();

        builder.HasOne(s => s.Document)
            .WithMany()
            .HasForeignKey(s => s.DocumentId)
            .IsRequired(false)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(s => s.YouTubeVideo)
            .WithMany()
            .HasForeignKey(s => s.YouTubeVideoId)
            .IsRequired(false)
            .OnDelete(DeleteBehavior.Cascade);

        builder.ToTable(t => t.HasCheckConstraint("chk_quiz_submissions_source",
            "(\"DocumentId\" IS NOT NULL AND \"YouTubeVideoId\" IS NULL AND \"SourceType\" = 'document') OR " +
            "(\"YouTubeVideoId\" IS NOT NULL AND \"DocumentId\" IS NULL AND \"SourceType\" = 'video')"));

        builder.HasIndex(s => new { s.DocumentId, s.UserId });
        builder.HasIndex(s => new { s.YouTubeVideoId, s.UserId });

        // Serves the submissions history list: WHERE UserId = @u ORDER BY SubmittedAt DESC.
        // The two indexes above lead with DocumentId/YouTubeVideoId, so a UserId-only filter
        // can't use them.
        builder.HasIndex(s => new { s.UserId, s.SubmittedAt });
    }
}
