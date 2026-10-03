namespace StudyPlatform.Domain.Projections;

/// <summary>
/// Lightweight document row for "pick recent candidates" use cases (e.g. recommendations'
/// "materials you haven't been quizzed on" list). Deliberately omits the heavy text columns
/// (Summary, MindMapText, Transcript) so they are never read from the DB or shipped over the wire.
/// </summary>
public record DocumentListItem(
    Guid DocumentId,
    Guid CourseId,
    string FileName,
    DateTime CreatedAt);
