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
        builder.Property(f => f.CardType).IsRequired().HasMaxLength(10).HasDefaultValue("basic");
        builder.Property(f => f.Difficulty).IsRequired().HasMaxLength(10).HasDefaultValue("medium");
        builder.Property(f => f.Chapter).HasColumnType("text");
        builder.Property(f => f.Tags).HasColumnType("text[]").HasDefaultValueSql("'{}'::text[]");
        builder.Property(f => f.CreatedAt).IsRequired();
        builder.Property(f => f.UpdatedAt).IsRequired();

        builder.HasOne(f => f.Document)
            .WithMany(d => d.Flashcards)
            .HasForeignKey(f => f.DocumentId)
            .OnDelete(DeleteBehavior.Cascade)
            .IsRequired(false);

        builder.HasOne(f => f.Video)
            .WithMany()
            .HasForeignKey(f => f.VideoId)
            .IsRequired(false)
            .OnDelete(DeleteBehavior.Cascade);

        builder.ToTable(t => t.HasCheckConstraint("chk_flashcards_source",
            "(\"DocumentId\" IS NOT NULL AND \"VideoId\" IS NULL AND \"SourceType\" = 'document') OR " +
            "(\"VideoId\" IS NOT NULL AND \"DocumentId\" IS NULL AND \"SourceType\" = 'video')"));

        // Serves the flashcards list / search: WHERE UserId = @u ORDER BY CreatedAt DESC.
        builder.HasIndex(f => new { f.UserId, f.CreatedAt });

        // Trigram indexes for the ILIKE '%term%' searches in FlashcardRepository.
        builder.HasIndex(f => f.Front).HasMethod("gin").HasOperators("gin_trgm_ops");
        builder.HasIndex(f => f.Back).HasMethod("gin").HasOperators("gin_trgm_ops");
    }
}
