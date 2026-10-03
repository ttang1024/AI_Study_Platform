using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using StudyPlatform.Domain.Entities;

namespace StudyPlatform.Infrastructure.Data.Configurations;

public class DocumentConfiguration : IEntityTypeConfiguration<Document>
{
    public void Configure(EntityTypeBuilder<Document> builder)
    {
        builder.HasKey(d => d.DocumentId);
        builder.Property(d => d.FileName).IsRequired().HasMaxLength(500);
        builder.Property(d => d.BlobUrl).IsRequired().HasMaxLength(2000);
        builder.Property(d => d.ContentType).IsRequired().HasMaxLength(100);
        builder.Property(d => d.FileSize).IsRequired();
        builder.Property(d => d.FileHash).HasMaxLength(64);
        builder.Property(d => d.Summary).HasColumnType("text");
        builder.Property(d => d.MindMapText).HasColumnType("text");
        builder.Property(d => d.OriginalUrl).HasMaxLength(2000);
        builder.Property(d => d.CreatedAt).IsRequired();
        builder.Property(d => d.UpdatedAt).IsRequired();

        builder.HasOne(d => d.Course)
            .WithMany(c => c.Documents)
            .HasForeignKey(d => d.CourseId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(d => d.User)
            .WithMany()
            .HasForeignKey(d => d.UserId)
            .OnDelete(DeleteBehavior.NoAction);

        builder.HasIndex(d => new { d.UserId, d.FileHash })
            .IsUnique()
            .HasFilter("\"FileHash\" IS NOT NULL");

        // Serves the paginated library list: WHERE UserId = @u ORDER BY CreatedAt DESC.
        // The (UserId, FileHash) index can't satisfy the CreatedAt ordering, so without this
        // every page load sorts the user's whole document set.
        builder.HasIndex(d => new { d.UserId, d.CreatedAt });

        // Trigram indexes for the ILIKE '%term%' searches in DocumentRepository/LibraryRepository.
        // The leading wildcard rules out a B-tree, so these are what keeps keyword search off a
        // sequential scan of every document the user owns.
        builder.HasIndex(d => d.FileName).HasMethod("gin").HasOperators("gin_trgm_ops");
        builder.HasIndex(d => d.Summary).HasMethod("gin").HasOperators("gin_trgm_ops");
    }
}
