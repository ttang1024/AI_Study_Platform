using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using StudyPlatform.Domain.Entities;

namespace StudyPlatform.Infrastructure.Data.Configurations;

public class VideoTranscriptEntryConfiguration : IEntityTypeConfiguration<VideoTranscriptEntry>
{
    public void Configure(EntityTypeBuilder<VideoTranscriptEntry> builder)
    {
        builder.HasKey(e => new { e.VideoId, e.Kind });
        builder.Property(e => e.VideoId).HasMaxLength(32);
        builder.Property(e => e.Kind).HasMaxLength(32);
        builder.Property(e => e.SegmentsJson).HasColumnType("text").IsRequired();
        builder.Property(e => e.ExpiresAt).IsRequired();
        builder.Property(e => e.CreatedAt).IsRequired();
        builder.Property(e => e.UpdatedAt).IsRequired();
        builder.HasIndex(e => e.ExpiresAt);
    }
}
