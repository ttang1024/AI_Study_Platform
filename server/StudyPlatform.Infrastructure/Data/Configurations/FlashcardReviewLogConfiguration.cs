using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using StudyPlatform.Domain.Entities;

namespace StudyPlatform.Infrastructure.Data.Configurations;

public class FlashcardReviewLogConfiguration : IEntityTypeConfiguration<FlashcardReviewLog>
{
    public void Configure(EntityTypeBuilder<FlashcardReviewLog> builder)
    {
        builder.HasKey(l => l.Id);
        builder.HasIndex(l => new { l.UserId, l.ReviewedAt });
        builder.HasIndex(l => new { l.UserId, l.FlashcardId });
    }
}
