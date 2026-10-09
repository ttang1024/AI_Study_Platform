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

        // Optimistic concurrency on Postgres's own xmin system column (no schema change): two
        // simultaneous reviews of one card used to both read the same state, both write, and log the
        // review twice. Now the second save fails with ConcurrencyConflictException (409).
        builder.Property<uint>("Version").IsRowVersion();
        builder.HasIndex(s => new { s.UserId, s.Due });
    }
}
