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

        // Defaults true, and the default is declared here rather than left to the C# initializer so
        // the generated migration backfills existing rows as open. A bool column added without one
        // lands as false, which would silently close enrollment on every classroom already running.
        builder.Property(c => c.EnrollmentOpen).IsRequired().HasDefaultValue(true);

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

public class ClassroomAssignmentConfiguration : IEntityTypeConfiguration<ClassroomAssignment>
{
    public void Configure(EntityTypeBuilder<ClassroomAssignment> builder)
    {
        builder.HasKey(a => a.ClassroomAssignmentId);

        builder.Property(a => a.Title).IsRequired().HasMaxLength(200);
        builder.Property(a => a.Instructions).HasMaxLength(20000);
        builder.Property(a => a.PointsPossible).IsRequired();
        builder.Property(a => a.AllowLateSubmissions).IsRequired();
        builder.Property(a => a.CreatedAt).IsRequired();
        builder.Property(a => a.UpdatedAt).IsRequired();

        // The list query filters by classroom and orders by due date.
        builder.HasIndex(a => new { a.ClassroomId, a.DueAt });

        builder.HasOne(a => a.Classroom)
            .WithMany()
            .HasForeignKey(a => a.ClassroomId)
            .OnDelete(DeleteBehavior.Cascade);

        // Unassigning a course must not delete work already handed in against it, so the link goes
        // null rather than cascading.
        builder.HasOne(a => a.Course)
            .WithMany()
            .HasForeignKey(a => a.CourseId)
            .OnDelete(DeleteBehavior.SetNull);

        builder.HasOne(a => a.CreatedBy)
            .WithMany()
            .HasForeignKey(a => a.CreatedByUserId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasMany(a => a.Submissions)
            .WithOne(s => s.Assignment)
            .HasForeignKey(s => s.ClassroomAssignmentId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}

public class ClassroomSubmissionConfiguration : IEntityTypeConfiguration<ClassroomSubmission>
{
    public void Configure(EntityTypeBuilder<ClassroomSubmission> builder)
    {
        builder.HasKey(s => s.ClassroomSubmissionId);

        builder.Property(s => s.Text).IsRequired().HasMaxLength(100000);
        builder.Property(s => s.Feedback).HasMaxLength(20000);
        builder.Property(s => s.CreatedAt).IsRequired();
        builder.Property(s => s.UpdatedAt).IsRequired();

        // One submission per student per assignment: a resubmission overwrites the draft in place.
        // Unlike EssaySubmission there is no revision chain here — the instructor grades what was
        // handed in, and keeping superseded drafts would make "the submission" ambiguous.
        builder.HasIndex(s => new { s.ClassroomAssignmentId, s.StudentUserId }).IsUnique();
        builder.HasIndex(s => s.StudentUserId);

        builder.HasOne(s => s.Student)
            .WithMany()
            .HasForeignKey(s => s.StudentUserId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(s => s.GradedBy)
            .WithMany()
            .HasForeignKey(s => s.GradedByUserId)
            .OnDelete(DeleteBehavior.SetNull);
    }
}
