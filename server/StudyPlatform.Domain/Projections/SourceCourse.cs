namespace StudyPlatform.Domain.Projections;

/// <summary>
/// A document or video reduced to what cross-library views need: which course it belongs to and what it
/// is called. Handlers that only mapped ids to courses used to load every full row to get it — extracted
/// text, transcripts and summaries included, often hundreds of MB for a large library.
/// </summary>
public record SourceCourse(Guid Id, Guid CourseId, string Name);
