using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using StudyPlatform.Domain.Entities;

namespace StudyPlatform.Infrastructure.Data.Configurations;

public class YouTubeVideoConfiguration : IEntityTypeConfiguration<YouTubeVideo>
{
    public void Configure(EntityTypeBuilder<YouTubeVideo> builder)
    {
        builder.HasKey(v => v.YouTubeVideoId);
        builder.Property(v => v.VideoId).IsRequired().HasMaxLength(50);
        builder.Property(v => v.VideoUrl).IsRequired().HasMaxLength(500);
        builder.Property(v => v.Title).IsRequired().HasMaxLength(500);
        builder.Property(v => v.ThumbnailUrl).IsRequired().HasMaxLength(500);
        builder.Property(v => v.Summary).HasColumnType("text");
        builder.Property(v => v.MindMapText).HasColumnType("text");
        builder.Property(v => v.Transcript).HasColumnType("text");
        builder.Property(v => v.CreatedAt).IsRequired();
        builder.Property(v => v.UpdatedAt).IsRequired();

        builder.HasOne(v => v.Course)
            .WithMany()
            .HasForeignKey(v => v.CourseId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(v => v.User)
            .WithMany()
            .HasForeignKey(v => v.UserId)
            .OnDelete(DeleteBehavior.NoAction);
    }
}
