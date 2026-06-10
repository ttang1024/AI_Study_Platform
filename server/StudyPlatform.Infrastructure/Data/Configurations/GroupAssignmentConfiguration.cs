using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using StudyPlatform.Domain.Entities;

namespace StudyPlatform.Infrastructure.Data.Configurations;

public class GroupAssignmentConfiguration : IEntityTypeConfiguration<GroupAssignment>
{
    public void Configure(EntityTypeBuilder<GroupAssignment> builder)
    {
        builder.HasKey(a => a.GroupAssignmentId);
        builder.Property(a => a.Title).IsRequired().HasMaxLength(300);
        builder.Property(a => a.LinkUrl).HasMaxLength(500);

        builder.HasIndex(a => new { a.GroupId, a.CreatedAt });

        builder.HasOne(a => a.Group)
            .WithMany()
            .HasForeignKey(a => a.GroupId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}

public class GroupAssignmentCompletionConfiguration : IEntityTypeConfiguration<GroupAssignmentCompletion>
{
    public void Configure(EntityTypeBuilder<GroupAssignmentCompletion> builder)
    {
        builder.HasKey(c => c.GroupAssignmentCompletionId);

        builder.HasIndex(c => new { c.AssignmentId, c.UserId }).IsUnique();

        builder.HasOne(c => c.Assignment)
            .WithMany(a => a.Completions)
            .HasForeignKey(c => c.AssignmentId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(c => c.User)
            .WithMany()
            .HasForeignKey(c => c.UserId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
