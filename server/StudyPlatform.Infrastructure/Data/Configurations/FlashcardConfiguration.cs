using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using StudyPlatform.Domain.Entities;

namespace StudyPlatform.Infrastructure.Data.Configurations;

public class FlashcardConfiguration : IEntityTypeConfiguration<Flashcard>
{
    public void Configure(EntityTypeBuilder<Flashcard> builder)
    {
        builder.HasKey(f => f.FlashcardId);
        builder.Property(f => f.Front).IsRequired().HasColumnType("text");
        builder.Property(f => f.Back).IsRequired().HasColumnType("text");
        builder.Property(f => f.SourceType).IsRequired().HasMaxLength(20).HasDefaultValue("document");
        builder.Property(f => f.CreatedAt).IsRequired();
        builder.Property(f => f.UpdatedAt).IsRequired();

        builder.HasOne(f => f.Document)
            .WithMany(d => d.Flashcards)
            .HasForeignKey(f => f.DocumentId)
            .OnDelete(DeleteBehavior.Cascade)
            .IsRequired(false);

        builder.HasOne(f => f.YouTubeVideo)
            .WithMany()
            .HasForeignKey(f => f.YouTubeVideoId)
            .IsRequired(false)
            .OnDelete(DeleteBehavior.Cascade);

        builder.ToTable(t => t.HasCheckConstraint("chk_flashcards_source",
            "(\"DocumentId\" IS NOT NULL AND \"YouTubeVideoId\" IS NULL AND \"SourceType\" = 'document') OR " +
            "(\"YouTubeVideoId\" IS NOT NULL AND \"DocumentId\" IS NULL AND \"SourceType\" = 'video')"));
    }
}
