using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using StudyPlatform.Domain.Entities;

namespace StudyPlatform.Infrastructure.Data.Configurations;

public class CourseAudioOverviewConfiguration : IEntityTypeConfiguration<CourseAudioOverview>
{
    public void Configure(EntityTypeBuilder<CourseAudioOverview> builder)
    {
        builder.HasKey(o => o.Id);
        builder.Property(o => o.Status).HasMaxLength(20);

        builder.HasOne(o => o.Course)
            .WithMany()
            .HasForeignKey(o => o.CourseId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasIndex(o => new { o.UserId, o.CourseId });
    }
}
