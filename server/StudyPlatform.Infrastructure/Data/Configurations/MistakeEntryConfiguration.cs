using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using StudyPlatform.Domain.Entities;

namespace StudyPlatform.Infrastructure.Data.Configurations;

public class MistakeEntryConfiguration : IEntityTypeConfiguration<MistakeEntry>
{
    public void Configure(EntityTypeBuilder<MistakeEntry> builder)
    {
        builder.HasKey(m => m.MistakeEntryId);
        builder.Property(m => m.SourceType).IsRequired().HasMaxLength(20);
        builder.Property(m => m.Status).IsRequired().HasMaxLength(20);
        builder.Property(m => m.Question).IsRequired();
        builder.Property(m => m.CorrectAnswer).IsRequired();

        builder.HasIndex(m => new { m.UserId, m.Status });
        builder.HasIndex(m => new { m.UserId, m.QuizId });

        builder.HasOne(m => m.User)
            .WithMany()
            .HasForeignKey(m => m.UserId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
