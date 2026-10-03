namespace StudyPlatform.Application.Notes.DTOs;

public record CreateNoteRequest(string Content, string? Title = null, Guid? DocumentId = null, Guid? VideoId = null);

public record UpdateNoteRequest(string Content, string? Title = null);

public record NoteDto(
    Guid NoteId,
    Guid UserId,
    Guid? DocumentId,
    Guid? VideoId,
    string SourceType,
    string Content,
    string? Title,
    DateTime CreatedAt,
    DateTime UpdatedAt,
    string? Document = null,
    string? Video = null);

public record BulkDeleteNotesRequest(IEnumerable<Guid> NoteIds);
