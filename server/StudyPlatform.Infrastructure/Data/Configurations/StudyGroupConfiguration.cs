using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using StudyPlatform.Domain.Entities;

namespace StudyPlatform.Infrastructure.Data.Configurations;

public class StudyGroupConfiguration : IEntityTypeConfiguration<StudyGroup>
{
    public void Configure(EntityTypeBuilder<StudyGroup> builder)
    {
        builder.HasKey(g => g.StudyGroupId);

        builder.Property(g => g.Name).IsRequired().HasMaxLength(200);
        builder.Property(g => g.InviteCode).IsRequired().HasMaxLength(20);
        builder.Property(g => g.CreatedAt).IsRequired();

        builder.HasIndex(g => g.InviteCode).IsUnique();

        builder.HasOne(g => g.Owner)
            .WithMany()
            .HasForeignKey(g => g.OwnerId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasMany(g => g.Members)
            .WithOne(m => m.Group)
            .HasForeignKey(m => m.GroupId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasMany(g => g.SharedCourses)
            .WithOne(sc => sc.Group)
            .HasForeignKey(sc => sc.GroupId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasMany(g => g.Messages)
            .WithOne(m => m.Group)
            .HasForeignKey(m => m.GroupId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}

public class StudyGroupMemberConfiguration : IEntityTypeConfiguration<StudyGroupMember>
{
    public void Configure(EntityTypeBuilder<StudyGroupMember> builder)
    {
        builder.HasKey(m => m.StudyGroupMemberId);

        builder.Property(m => m.Role).IsRequired().HasMaxLength(20);
        builder.Property(m => m.JoinedAt).IsRequired();

        builder.HasIndex(m => new { m.GroupId, m.UserId }).IsUnique();

        builder.HasOne(m => m.User)
            .WithMany()
            .HasForeignKey(m => m.UserId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}

public class GroupChatMessageConfiguration : IEntityTypeConfiguration<GroupChatMessage>
{
    public void Configure(EntityTypeBuilder<GroupChatMessage> builder)
    {
        builder.HasKey(m => m.GroupChatMessageId);

        builder.Property(m => m.Content).IsRequired();
        builder.Property(m => m.SentAt).IsRequired();

        builder.HasIndex(m => m.GroupId);

        builder.HasOne(m => m.User)
            .WithMany()
            .HasForeignKey(m => m.UserId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}

public class StudyGroupSharedCourseConfiguration : IEntityTypeConfiguration<StudyGroupSharedCourse>
{
    public void Configure(EntityTypeBuilder<StudyGroupSharedCourse> builder)
    {
        builder.HasKey(sc => sc.StudyGroupSharedCourseId);

        builder.Property(sc => sc.SharedAt).IsRequired();

        builder.HasOne(sc => sc.Course)
            .WithMany()
            .HasForeignKey(sc => sc.CourseId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(sc => sc.SharedBy)
            .WithMany()
            .HasForeignKey(sc => sc.SharedByUserId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}
