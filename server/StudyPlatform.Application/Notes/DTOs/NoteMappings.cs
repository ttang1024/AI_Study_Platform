using StudyPlatform.Domain.Entities;

namespace StudyPlatform.Application.Notes.DTOs;

/// <summary>Shared entity → DTO projection for notes, used across the note, document and video endpoints.</summary>
public static class NoteMappings
{
    public static NoteDto ToNoteDto(this Note n) => new(
        n.NoteId, n.UserId, n.DocumentId, n.YouTubeVideoId, n.SourceType, n.Content, n.Title, n.CreatedAt, n.UpdatedAt,
        Document: n.Document?.FileName,
        Video: n.YouTubeVideo?.Title);
}
