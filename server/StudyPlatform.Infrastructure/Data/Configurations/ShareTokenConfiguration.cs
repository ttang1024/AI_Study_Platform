using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using StudyPlatform.Domain.Entities;

namespace StudyPlatform.Infrastructure.Data.Configurations;

public class ShareTokenConfiguration : IEntityTypeConfiguration<ShareToken>
{
    public void Configure(EntityTypeBuilder<ShareToken> builder)
    {
        builder.HasKey(s => s.Id);
        builder.Property(s => s.Token).IsRequired().HasMaxLength(32);
        builder.Property(s => s.Title).IsRequired().HasMaxLength(500);
        builder.Property(s => s.Summary).HasColumnType("text");
        builder.Property(s => s.MindMapText).HasColumnType("text");
        builder.Property(s => s.NotesHtml).HasColumnType("text");
        builder.Property(s => s.QuizzesJson).HasColumnType("text");
        builder.Property(s => s.FlashcardsJson).HasColumnType("text");
        builder.Property(s => s.SourceType).HasMaxLength(50);
        builder.Property(s => s.SourceUrl).HasMaxLength(2000);
        builder.Property(s => s.OriginalArticleUrl).HasMaxLength(2000);
        builder.HasIndex(s => s.Token).IsUnique();
        builder.HasIndex(s => s.OwnerId);
    }
}
