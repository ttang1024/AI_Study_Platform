using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using StudyPlatform.Domain.Entities;

namespace StudyPlatform.Infrastructure.Data.Configurations;

public class VideoConfiguration : IEntityTypeConfiguration<Video>
{
    public void Configure(EntityTypeBuilder<Video> builder)
    {
        builder.HasKey(v => v.VideoId);
        builder.Property(v => v.ExternalVideoId).IsRequired().HasMaxLength(50);
        builder.Property(v => v.VideoUrl).IsRequired().HasMaxLength(500);
        builder.Property(v => v.SourceType).IsRequired().HasMaxLength(20).HasDefaultValue("youtube");
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
