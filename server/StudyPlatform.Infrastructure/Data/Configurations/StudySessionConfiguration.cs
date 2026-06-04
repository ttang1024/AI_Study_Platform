using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using StudyPlatform.Domain.Entities;

namespace StudyPlatform.Infrastructure.Data.Configurations;

public class StudySessionConfiguration : IEntityTypeConfiguration<StudySession>
{
    public void Configure(EntityTypeBuilder<StudySession> builder)
    {
        builder.HasKey(s => s.StudySessionId);
        builder.Property(s => s.ContextType).IsRequired().HasMaxLength(40);
        builder.Property(s => s.DurationSeconds).IsRequired();
        builder.Property(s => s.OccurredAt).IsRequired();

        builder.HasIndex(s => new { s.UserId, s.OccurredAt });

        builder.HasOne(s => s.User)
            .WithMany()
            .HasForeignKey(s => s.UserId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
