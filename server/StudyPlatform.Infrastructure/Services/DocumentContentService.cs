using StudyPlatform.Application.Common;
using StudyPlatform.Application.Services;
using StudyPlatform.Domain.Entities;

namespace StudyPlatform.Infrastructure.Services;

public class DocumentContentService : IDocumentContentService
{
    // Ceiling on a file we are willing to hand to a provider as inline base64.
    //
    // Two separate limits meet here and the smaller one wins. Memory: the bytes are materialised
    // once by the download, again by Convert.ToBase64String (which is UTF-16, so 40 MB of PDF
    // becomes a ~107 MB string), and again by JSON serialisation — several hundred MB of
    // large-object allocations for one request, on a container whose .NET heap limit is a fraction
    // of its 2 GB. That is what threw OutOfMemoryException. Provider: inline request payloads are
    // capped around 20 MB, and base64 inflates by 4/3, so anything over ~15 MB of raw bytes is
    // refused by the API even when it fits in memory.
    //
    // 12 MB raw → ~16 MB base64, leaving headroom for the prompt. Larger files take the text
    // extraction path instead, which streams page by page rather than holding the whole file.
    private const long MaxInlineBytes = 12L * 1024 * 1024;

    private readonly IBlobStorageService _blobStorageService;
    private readonly IDocumentTextExtractor _textExtractor;

    public DocumentContentService(IBlobStorageService blobStorageService, IDocumentTextExtractor textExtractor)
    {
        _blobStorageService = blobStorageService;
        _textExtractor = textExtractor;
    }

    public async Task<DocumentContent> GetContentAsync(Document document, CancellationToken cancellationToken = default)
    {
        var inlineable = AiInlineData.IsSupported(document.ContentType) && FitsInline(document);

        if (document.ContentType.StartsWith("audio/", StringComparison.OrdinalIgnoreCase))
        {
            if (!string.IsNullOrEmpty(document.Transcript))
                return new DocumentContent(null, document.Transcript);

            if (inlineable)
                return new DocumentContent(await DownloadBytesAsync(document, cancellationToken), null);

            // Audio has no text-extraction fallback: without a transcript there is nothing to
            // summarise, and returning an empty string would ask the model to summarise nothing
            // and present whatever it invented as the summary. Fail loudly instead.
            if (AiInlineData.IsSupported(document.ContentType))
                throw new InvalidOperationException(
                    $"This audio file is {document.FileSize / (1024 * 1024)} MB, over the {MaxInlineBytes / (1024 * 1024)} MB limit for sending audio to the AI provider. Transcribe it first, then generate the summary.");

            return new DocumentContent(null, string.Empty);
        }

        if (inlineable)
            return new DocumentContent(await DownloadBytesAsync(document, cancellationToken), null);

        var text = await _textExtractor.ExtractTextAsync(document.BlobUrl, document.ContentType, cancellationToken);
        return new DocumentContent(null, text);
    }

    // FileSize is what the upload recorded. Treat a missing/zero size as "unknown" and allow it
    // through rather than blocking every document written before the column was populated — the
    // download below is still bounded by the provider's own limit in that case.
    private static bool FitsInline(Document document) =>
        document.FileSize <= 0 || document.FileSize <= MaxInlineBytes;

    private async Task<byte[]> DownloadBytesAsync(Document document, CancellationToken cancellationToken)
    {
        var stream = await _blobStorageService.DownloadAsync(document.BlobUrl, cancellationToken);
        // Pre-size the buffer: an unsized MemoryStream doubles its capacity as it fills, so a 12 MB
        // file walks through 1+2+4+8+16 MB of large-object allocations before it lands.
        using var ms = document.FileSize is > 0 and <= MaxInlineBytes
            ? new MemoryStream((int)document.FileSize)
            : new MemoryStream();
        await stream.CopyToAsync(ms, cancellationToken);
        return ms.ToArray();
    }
}
