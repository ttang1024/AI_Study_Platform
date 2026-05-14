using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using StudyPlatform.Domain.Entities;

namespace StudyPlatform.Infrastructure.Data.Configurations;

public class FlashcardSrsDataConfiguration : IEntityTypeConfiguration<FlashcardSrsData>
{
    public void Configure(EntityTypeBuilder<FlashcardSrsData> builder)
    {
        builder.HasKey(s => s.Id);

        builder.HasOne(s => s.Flashcard)
            .WithMany()
            .HasForeignKey(s => s.FlashcardId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasIndex(s => new { s.UserId, s.FlashcardId }).IsUnique();
        builder.HasIndex(s => new { s.UserId, s.Due });
    }
}
