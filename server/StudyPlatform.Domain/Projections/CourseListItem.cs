namespace StudyPlatform.Domain.Projections;

/// <summary>
/// A course as every list, stats and analytics view actually consumes it: its label, its colour, and how
/// many documents it holds.
///
/// The count is a SQL COUNT, not <c>Documents.Count</c> over a loaded collection. <c>Include(c =&gt;
/// c.Documents)</c> is the obvious spelling, but a Document carries its Summary, MindMapText and
/// Transcript, so including the collection reads the user's entire library text out of the database in
/// order to render a number — on the courses list, the stats endpoint, course mastery and time-on-task
/// alike.
/// </summary>
public record CourseListItem(
    Guid CourseId,
    Guid UserId,
    string CourseName,
    string CourseColor,
    int DocumentCount,
    DateTime CreatedAt,
    DateTime UpdatedAt);
