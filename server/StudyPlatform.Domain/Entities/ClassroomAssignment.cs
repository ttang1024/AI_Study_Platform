namespace StudyPlatform.Domain.Entities;

/// <summary>
/// A piece of work an instructor sets for a classroom and collects back — the hand-in loop that the
/// gradebook's derived metrics cannot express.
///
/// Distinct from <see cref="ClassroomCourse"/>: assigning a course grants read access to material and
/// the gradebook infers progress from whatever the student happens to do with it. An assignment asks
/// for something specific back, and nothing exists until the student writes it.
///
/// Distinct from GroupAssignment, which is a shared checklist every peer marks off for themselves. Here
/// the submission is private to its author and the teaching staff, and only staff can score it.
/// </summary>
public class ClassroomAssignment
{
    public Guid ClassroomAssignmentId { get; set; }
    public Guid ClassroomId { get; set; }
    public Guid CreatedByUserId { get; set; }

    public string Title { get; set; } = string.Empty;

    /// <summary>The task itself. Plain text with line breaks preserved; students see it read-only.</summary>
    public string? Instructions { get; set; }

    /// <summary>
    /// Optional course this work is set against, which must already be assigned to the classroom.
    /// Only used to give the student a link to the material — the grade never derives from it.
    /// </summary>
    public Guid? CourseId { get; set; }

    /// <summary>Denominator for the score. Points awarded are stored absolute so a later change here doesn't silently restate past grades.</summary>
    public double PointsPossible { get; set; } = 100;

    public DateTime? DueAt { get; set; }

    /// <summary>When false, the server refuses submissions after <see cref="DueAt"/> instead of flagging them late.</summary>
    public bool AllowLateSubmissions { get; set; } = true;

    /// <summary>
    /// Null while the assignment is a draft. Students cannot see or submit to a draft, which is what
    /// lets an instructor write one over several sittings without the class watching it change.
    /// </summary>
    public DateTime? PublishedAt { get; set; }

    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }

    public Classroom Classroom { get; set; } = null!;
    public Course? Course { get; set; }
    public User CreatedBy { get; set; } = null!;
    public ICollection<ClassroomSubmission> Submissions { get; set; } = new List<ClassroomSubmission>();
}

/// <summary>
/// One student's answer to a <see cref="ClassroomAssignment"/>, and the grade on it.
///
/// A row exists as soon as the student saves a draft, so <see cref="SubmittedAt"/> — not the row's
/// existence — is what "handed in" means. Drafts are never visible to staff.
/// </summary>
public class ClassroomSubmission
{
    public Guid ClassroomSubmissionId { get; set; }
    public Guid ClassroomAssignmentId { get; set; }
    public Guid StudentUserId { get; set; }

    public string Text { get; set; } = string.Empty;

    /// <summary>Null while this is a draft the student is still writing.</summary>
    public DateTime? SubmittedAt { get; set; }

    /// <summary>Absolute points, not a percentage — see <see cref="ClassroomAssignment.PointsPossible"/>.</summary>
    public double? PointsAwarded { get; set; }

    public string? Feedback { get; set; }
    public Guid? GradedByUserId { get; set; }

    /// <summary>Set when the grade is released to the student. Until then they see "submitted".</summary>
    public DateTime? GradedAt { get; set; }

    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }

    public ClassroomAssignment Assignment { get; set; } = null!;
    public User Student { get; set; } = null!;
    public User? GradedBy { get; set; }
}

/// <summary>
/// What a submission looks like to the UI. Derived from timestamps rather than stored, so a row can
/// never disagree with itself about whether it was handed in.
/// </summary>
public static class SubmissionStatus
{
    public const string NotStarted = "not_started";
    public const string Draft = "draft";
    public const string Submitted = "submitted";
    public const string Late = "late";
    public const string Graded = "graded";

    public static string Resolve(ClassroomSubmission? submission, DateTime? dueAt)
    {
        if (submission == null) return NotStarted;
        if (submission.GradedAt != null) return Graded;
        if (submission.SubmittedAt == null) return Draft;
        return dueAt != null && submission.SubmittedAt > dueAt ? Late : Submitted;
    }
}
