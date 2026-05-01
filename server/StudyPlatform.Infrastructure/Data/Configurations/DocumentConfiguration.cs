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
    }
}
