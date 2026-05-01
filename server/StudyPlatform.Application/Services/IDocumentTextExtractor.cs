namespace StudyPlatform.Application.Services;

public interface IDocumentTextExtractor
{
    Task<string> ExtractTextAsync(string blobUrl, string contentType, CancellationToken cancellationToken = default);
}
