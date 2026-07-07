using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using StudyPlatform.Domain.Entities;

namespace StudyPlatform.Infrastructure.Data.Configurations;

public class QuizConfiguration : IEntityTypeConfiguration<Quiz>
{
    public void Configure(EntityTypeBuilder<Quiz> builder)
    {
        builder.HasKey(q => q.QuizId);
        builder.Property(q => q.Question).IsRequired().HasColumnType("text");
        builder.Property(q => q.OptionsJson).IsRequired().HasColumnType("jsonb");
        builder.Property(q => q.CorrectAnswer).IsRequired().HasMaxLength(10);
        builder.Property(q => q.Explanation).IsRequired().HasColumnType("text");
        builder.Property(q => q.Difficulty).IsRequired().HasMaxLength(20).HasDefaultValue("medium");
        builder.Property(q => q.SourceType).IsRequired().HasMaxLength(20).HasDefaultValue("document");
        builder.Property(q => q.CreatedAt).IsRequired();

        builder.HasOne(q => q.Document)
            .WithMany(d => d.Quizzes)
            .HasForeignKey(q => q.DocumentId)
            .IsRequired(false)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(q => q.Video)
            .WithMany()
            .HasForeignKey(q => q.VideoId)
            .IsRequired(false)
            .OnDelete(DeleteBehavior.Cascade);

        builder.ToTable(t => t.HasCheckConstraint("chk_quizzes_source",
            "(\"DocumentId\" IS NOT NULL AND \"VideoId\" IS NULL AND \"SourceType\" = 'document') OR " +
            "(\"VideoId\" IS NOT NULL AND \"DocumentId\" IS NULL AND \"SourceType\" = 'video')"));
    }
}
