using StudyPlatform.Application.Common;
using StudyPlatform.Application.Services;
using StudyPlatform.Domain.Entities;

namespace StudyPlatform.Infrastructure.Services;

public class DocumentContentService : IDocumentContentService
{
    private readonly IBlobStorageService _blobStorageService;
    private readonly IDocumentTextExtractor _textExtractor;

    public DocumentContentService(IBlobStorageService blobStorageService, IDocumentTextExtractor textExtractor)
    {
        _blobStorageService = blobStorageService;
        _textExtractor = textExtractor;
    }

    public async Task<DocumentContent> GetContentAsync(Document document, CancellationToken cancellationToken = default)
    {
        if (document.ContentType.StartsWith("audio/", StringComparison.OrdinalIgnoreCase))
        {
            if (!string.IsNullOrEmpty(document.Transcript))
                return new DocumentContent(null, document.Transcript);

            if (AiInlineData.IsSupported(document.ContentType))
                return new DocumentContent(await DownloadBytesAsync(document.BlobUrl, cancellationToken), null);

            return new DocumentContent(null, string.Empty);
        }

        if (AiInlineData.IsSupported(document.ContentType))
            return new DocumentContent(await DownloadBytesAsync(document.BlobUrl, cancellationToken), null);

        var text = await _textExtractor.ExtractTextAsync(document.BlobUrl, document.ContentType, cancellationToken);
        return new DocumentContent(null, text);
    }

    private async Task<byte[]> DownloadBytesAsync(string blobUrl, CancellationToken cancellationToken)
    {
        var stream = await _blobStorageService.DownloadAsync(blobUrl, cancellationToken);
        using var ms = new MemoryStream();
        await stream.CopyToAsync(ms, cancellationToken);
        return ms.ToArray();
    }
}
