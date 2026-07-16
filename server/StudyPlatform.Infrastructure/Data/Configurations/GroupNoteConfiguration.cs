using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using StudyPlatform.Domain.Entities;

namespace StudyPlatform.Infrastructure.Data.Configurations;

public class GroupNoteConfiguration : IEntityTypeConfiguration<GroupNote>
{
    public void Configure(EntityTypeBuilder<GroupNote> builder)
    {
        builder.HasKey(n => n.Id);
        builder.Property(n => n.Title).HasMaxLength(300);
        builder.Property(n => n.ContentPreview).HasMaxLength(2000);

        builder.HasOne(n => n.Group)
            .WithMany()
            .HasForeignKey(n => n.GroupId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasIndex(n => n.GroupId);
    }
}
