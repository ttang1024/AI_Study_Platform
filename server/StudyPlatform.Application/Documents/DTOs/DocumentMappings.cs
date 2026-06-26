using StudyPlatform.Domain.Entities;

namespace StudyPlatform.Application.Documents.DTOs;

/// <summary>Shared entity → DTO projection for documents, used by document, podcast and audio endpoints.</summary>
public static class DocumentMappings
{
    public static DocumentDto ToDocumentDto(this Document d) => new(
        d.DocumentId, d.CourseId, d.UserId, d.FileName, d.BlobUrl, d.ContentType,
        d.FileSize, d.FileHash, d.Summary, d.MindMapText, d.CreatedAt, d.UpdatedAt,
        d.Transcript, d.OriginalUrl);
}
