using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using StudyPlatform.Domain.Entities;

namespace StudyPlatform.Infrastructure.Data.Configurations;

public class DocumentAnnotationConfiguration : IEntityTypeConfiguration<DocumentAnnotation>
{
    public void Configure(EntityTypeBuilder<DocumentAnnotation> builder)
    {
        builder.HasKey(a => a.DocumentAnnotationId);

        builder.Property(a => a.HighlightedText).IsRequired();
        builder.Property(a => a.Color).IsRequired().HasMaxLength(20);
        builder.Property(a => a.RectJson).IsRequired();
        builder.Property(a => a.CreatedAt).IsRequired();
        builder.Property(a => a.UpdatedAt).IsRequired();

        builder.HasIndex(a => a.DocumentId);

        builder.HasOne(a => a.Document)
            .WithMany()
            .HasForeignKey(a => a.DocumentId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(a => a.User)
            .WithMany()
            .HasForeignKey(a => a.UserId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
