namespace StudyPlatform.Domain.Interfaces;

/// <summary>
/// Cross-user aggregation for the instructor gradebook.
///
/// Like <see cref="IAdminAnalyticsRepository"/> this reads rows belonging to other users, so it is
/// deliberately a separate interface rather than another property on IUnitOfWork — that keeps the
/// "every repository call is scoped to the JWT user" reading of the ordinary repositories true.
///
/// It performs no authorization of its own. Callers must have already passed
/// ClassroomAccess.RequireGraderAsync for the classroom id they pass in.
/// </summary>
public interface IClassroomGradebookRepository
{
    Task<ClassroomGradebook> GetGradebookAsync(Guid classroomId, CancellationToken cancellationToken = default);

    /// <summary>
    /// Per-topic mastery for one student in one classroom, for the drill-down view.
    /// Returns null when the student is not on the classroom's active roster.
    /// </summary>
    Task<StudentClassroomDetail?> GetStudentDetailAsync(
        Guid classroomId, Guid studentUserId, CancellationToken cancellationToken = default);
}

// ── Result records ───────────────────────────────────────────────────────────

public record GradebookCourse(Guid CourseId, string CourseName, DateTime? DueAt);

/// <summary>
/// One student's progress in one assigned course. Score fields are null rather than zero when the
/// student has not attempted anything — "not started" and "scored 0%" must not render alike.
/// </summary>
public record GradebookCell(
    Guid CourseId,
    int QuizSubmissions,
    double? AverageScorePercent,
    int ProblemsAttempted,
    int ProblemsCorrect,
    long StudyMinutes,
    DateTime? LastActivityAt);

/// <summary>
/// A published assignment, as a gradebook column. Drafts are excluded — they are the instructor's
/// private workspace and nobody has been able to submit to one.
/// </summary>
public record GradebookAssignment(
    Guid ClassroomAssignmentId,
    string Title,
    double PointsPossible,
    DateTime? DueAt);

/// <summary>
/// One student's standing on one assignment. <paramref name="Status"/> is a SubmissionStatus value,
/// and PointsAwarded stays null until the grade is actually released — an ungraded hand-in and a zero
/// are different facts.
/// </summary>
public record GradebookSubmissionCell(
    Guid ClassroomAssignmentId,
    string Status,
    double? PointsAwarded,
    DateTime? SubmittedAt);

public record GradebookRow(
    Guid UserId,
    string FullName,
    string Email,
    IReadOnlyList<GradebookCell> Cells,
    double? OverallScorePercent,
    long TotalStudyMinutes,
    DateTime? LastActivityAt,
    IReadOnlyList<GradebookSubmissionCell> Assignments,
    /// <summary>Points earned over points available, across graded assignments only.</summary>
    double? AssignmentScorePercent,
    int AssignmentsSubmitted,
    int AssignmentsGraded);

public record ClassroomGradebook(
    Guid ClassroomId,
    IReadOnlyList<GradebookCourse> Courses,
    IReadOnlyList<GradebookRow> Rows,
    IReadOnlyList<GradebookAssignment> Assignments);

public record TopicMastery(string Topic, int Attempted, int Correct);

public record StudentClassroomDetail(
    Guid UserId,
    string FullName,
    string Email,
    IReadOnlyList<GradebookCell> Cells,
    IReadOnlyList<TopicMastery> WeakestTopics,
    IReadOnlyList<DailyCount> StudyMinutesTrend,
    IReadOnlyList<GradebookAssignment> Assignments,
    IReadOnlyList<GradebookSubmissionCell> Submissions,
    double? AssignmentScorePercent);
