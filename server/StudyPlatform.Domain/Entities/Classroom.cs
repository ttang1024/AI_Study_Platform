namespace StudyPlatform.Domain.Entities;

/// <summary>
/// A roster of students taught by one or more instructors inside an <see cref="Organization"/>.
///
/// Distinct from StudyGroup on purpose: a study group is peer-to-peer and every member is equal,
/// whereas a classroom has an asymmetric role model. Instructors read every student's submitted work
/// (see <see cref="ClassroomAssignment"/>) and their whole progress row in the gradebook; a student
/// reads only their own of either. Keeping them separate avoids retrofitting privilege onto the peer
/// model — <see cref="ClassroomRoles"/> is the gate, and Application/Classrooms/ClassroomAccess is
/// the single place it is checked.
/// </summary>
public class Classroom
{
    public Guid ClassroomId { get; set; }
    public Guid OrganizationId { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }

    /// <summary>
    /// Short code students enter to enroll themselves. Unique across the platform.
    ///
    /// A bearer credential for the roster, so it is rotatable: a code read aloud in a room or posted
    /// in a group chat cannot be un-shared, and before rotation existed the only remedy was archiving
    /// the whole class.
    /// </summary>
    public string JoinCode { get; set; } = string.Empty;

    /// <summary>
    /// When false the join code is refused outright, whatever it is. Rotating invalidates the old
    /// code; closing stops self-enrollment altogether — an instructor who has finished admitting a
    /// cohort should not have to keep a live credential in circulation to keep the class working.
    /// </summary>
    public bool EnrollmentOpen { get; set; } = true;

    /// <summary>The user who created the classroom. Always enrolled as an instructor.</summary>
    public Guid CreatedByUserId { get; set; }

    /// <summary>Set when the class ends. Archived classrooms are read-only but keep their gradebook.</summary>
    public DateTime? ArchivedAt { get; set; }

    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }

    public Organization Organization { get; set; } = null!;
    public User CreatedBy { get; set; } = null!;
    public ICollection<ClassroomEnrollment> Enrollments { get; set; } = new List<ClassroomEnrollment>();
    public ICollection<ClassroomCourse> Courses { get; set; } = new List<ClassroomCourse>();
}

/// <summary>Roles a user can hold inside a single classroom.</summary>
public static class ClassroomRoles
{
    public const string Instructor = "instructor";
    public const string Assistant = "assistant";
    public const string Student = "student";

    public static readonly string[] All = { Instructor, Assistant, Student };

    /// <summary>Roles allowed to read every student's work and edit the classroom.</summary>
    public static bool CanGrade(string role) => role is Instructor or Assistant;

    /// <summary>Roles allowed to change the roster and assign courses.</summary>
    public static bool CanManage(string role) => role is Instructor;
}

public class ClassroomEnrollment
{
    public Guid ClassroomEnrollmentId { get; set; }
    public Guid ClassroomId { get; set; }
    public Guid UserId { get; set; }

    /// <summary>One of <see cref="ClassroomRoles"/>.</summary>
    public string Role { get; set; } = ClassroomRoles.Student;

    public DateTime EnrolledAt { get; set; }

    /// <summary>Set when a student is removed. Kept rather than deleted so their grades survive.</summary>
    public DateTime? RemovedAt { get; set; }

    public Classroom Classroom { get; set; } = null!;
    public User User { get; set; } = null!;
}

/// <summary>
/// A course an instructor has assigned to a classroom. The course itself stays owned by the
/// instructor who built it; students get read access to its artifacts through this row.
/// </summary>
public class ClassroomCourse
{
    public Guid ClassroomCourseId { get; set; }
    public Guid ClassroomId { get; set; }
    public Guid CourseId { get; set; }
    public Guid AssignedByUserId { get; set; }
    public DateTime AssignedAt { get; set; }

    /// <summary>Optional deadline surfaced in the student's planner and the instructor's gradebook.</summary>
    public DateTime? DueAt { get; set; }

    public Classroom Classroom { get; set; } = null!;
    public Course Course { get; set; } = null!;
    public User AssignedBy { get; set; } = null!;
}
