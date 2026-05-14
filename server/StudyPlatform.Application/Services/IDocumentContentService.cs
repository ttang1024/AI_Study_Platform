using StudyPlatform.Domain.Entities;

namespace StudyPlatform.Application.Services;

public record DocumentContent(byte[]? Bytes, string? Text);

public interface IDocumentContentService
{
    Task<DocumentContent> GetContentAsync(Document document, CancellationToken cancellationToken = default);
}
