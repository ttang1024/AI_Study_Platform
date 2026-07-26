using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using StudyPlatform.Domain.Entities;

namespace StudyPlatform.Infrastructure.Data.Configurations;

public class OrganizationConfiguration : IEntityTypeConfiguration<Organization>
{
    public void Configure(EntityTypeBuilder<Organization> builder)
    {
        builder.HasKey(o => o.OrganizationId);

        builder.Property(o => o.Name).IsRequired().HasMaxLength(200);
        builder.Property(o => o.Slug).IsRequired().HasMaxLength(64);
        builder.Property(o => o.CreatedAt).IsRequired();
        builder.Property(o => o.UpdatedAt).IsRequired();

        builder.HasIndex(o => o.Slug).IsUnique();

        builder.HasOne(o => o.Owner)
            .WithMany()
            .HasForeignKey(o => o.OwnerId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasMany(o => o.Members)
            .WithOne(m => m.Organization)
            .HasForeignKey(m => m.OrganizationId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasMany(o => o.Classrooms)
            .WithOne(c => c.Organization)
            .HasForeignKey(c => c.OrganizationId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}

public class OrganizationMemberConfiguration : IEntityTypeConfiguration<OrganizationMember>
{
    public void Configure(EntityTypeBuilder<OrganizationMember> builder)
    {
        builder.HasKey(m => m.OrganizationMemberId);

        builder.Property(m => m.Role).IsRequired().HasMaxLength(20);
        builder.Property(m => m.JoinedAt).IsRequired();

        builder.HasIndex(m => new { m.OrganizationId, m.UserId }).IsUnique();
        builder.HasIndex(m => m.UserId);

        builder.HasOne(m => m.User)
            .WithMany()
            .HasForeignKey(m => m.UserId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}

public class ClassroomConfiguration : IEntityTypeConfiguration<Classroom>
{
    public void Configure(EntityTypeBuilder<Classroom> builder)
    {
        builder.HasKey(c => c.ClassroomId);

        builder.Property(c => c.Name).IsRequired().HasMaxLength(200);
        builder.Property(c => c.Description).HasMaxLength(2000);
        builder.Property(c => c.JoinCode).IsRequired().HasMaxLength(20);
        builder.Property(c => c.CreatedAt).IsRequired();
        builder.Property(c => c.UpdatedAt).IsRequired();

        builder.HasIndex(c => c.JoinCode).IsUnique();
        builder.HasIndex(c => c.OrganizationId);

        builder.HasOne(c => c.CreatedBy)
            .WithMany()
            .HasForeignKey(c => c.CreatedByUserId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasMany(c => c.Enrollments)
            .WithOne(e => e.Classroom)
            .HasForeignKey(e => e.ClassroomId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasMany(c => c.Courses)
            .WithOne(cc => cc.Classroom)
            .HasForeignKey(cc => cc.ClassroomId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}

public class ClassroomEnrollmentConfiguration : IEntityTypeConfiguration<ClassroomEnrollment>
{
    public void Configure(EntityTypeBuilder<ClassroomEnrollment> builder)
    {
        builder.HasKey(e => e.ClassroomEnrollmentId);

        builder.Property(e => e.Role).IsRequired().HasMaxLength(20);
        builder.Property(e => e.EnrolledAt).IsRequired();

        // Not unique on (ClassroomId, UserId): a removed student who re-enrolls gets a second row so
        // the first enrollment's grade history stays attributable to the period they were enrolled.
        builder.HasIndex(e => new { e.ClassroomId, e.UserId });
        builder.HasIndex(e => e.UserId);

        builder.HasOne(e => e.User)
            .WithMany()
            .HasForeignKey(e => e.UserId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}

public class ClassroomCourseConfiguration : IEntityTypeConfiguration<ClassroomCourse>
{
    public void Configure(EntityTypeBuilder<ClassroomCourse> builder)
    {
        builder.HasKey(cc => cc.ClassroomCourseId);

        builder.Property(cc => cc.AssignedAt).IsRequired();

        builder.HasIndex(cc => new { cc.ClassroomId, cc.CourseId }).IsUnique();

        builder.HasOne(cc => cc.Course)
            .WithMany()
            .HasForeignKey(cc => cc.CourseId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(cc => cc.AssignedBy)
            .WithMany()
            .HasForeignKey(cc => cc.AssignedByUserId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}
