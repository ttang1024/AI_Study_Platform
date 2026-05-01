using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using StudyPlatform.Domain.Entities;

namespace StudyPlatform.Infrastructure.Data.Configurations;

public class NoteConfiguration : IEntityTypeConfiguration<Note>
{
    public void Configure(EntityTypeBuilder<Note> builder)
    {
        builder.HasKey(n => n.NoteId);
        builder.Property(n => n.Content).IsRequired().HasColumnType("text");
        builder.Property(n => n.Title).HasMaxLength(500);
        builder.Property(n => n.SourceType).IsRequired().HasMaxLength(20).HasDefaultValue("document");
        builder.Property(n => n.CreatedAt).IsRequired();
        builder.Property(n => n.UpdatedAt).IsRequired();

        builder.HasOne(n => n.Document)
            .WithMany(d => d.Notes)
            .HasForeignKey(n => n.DocumentId)
            .IsRequired(false)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(n => n.YouTubeVideo)
            .WithMany()
            .HasForeignKey(n => n.YouTubeVideoId)
            .IsRequired(false)
            .OnDelete(DeleteBehavior.Cascade);

        builder.ToTable(t => t.HasCheckConstraint("chk_notes_source",
            "(\"DocumentId\" IS NOT NULL AND \"YouTubeVideoId\" IS NULL AND \"SourceType\" = 'document') OR " +
            "(\"YouTubeVideoId\" IS NOT NULL AND \"DocumentId\" IS NULL AND \"SourceType\" = 'video')"));
    }
}
