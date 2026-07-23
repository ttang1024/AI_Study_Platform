namespace StudyPlatform.Domain.Projections;

/// <summary>
/// A document as the knowledge graph sees it: a title, a course, enough to classify it as document /
/// article / audio, and whether it has any generated study artifact (which decides the node's weight).
/// The artifact flags are computed in SQL precisely so the graph never reads Summary, MindMapText or
/// Transcript — it only ever needed to know whether they are empty.
/// </summary>
public record DocumentGraphNode(
    Guid DocumentId,
    Guid CourseId,
    string FileName,
    string ContentType,
    string? OriginalUrl,
    bool HasStudyArtifacts);

/// <summary>Video counterpart of <see cref="DocumentGraphNode"/>.</summary>
public record VideoGraphNode(
    Guid VideoId,
    Guid CourseId,
    string Title,
    string ExternalVideoId,
    bool HasStudyArtifacts);
