using System.Text;
using DocumentFormat.OpenXml.Packaging;
using DocumentFormat.OpenXml.Wordprocessing;
using Microsoft.Extensions.Logging;
using StudyPlatform.Application.Services;
using UglyToad.PdfPig;

namespace StudyPlatform.Infrastructure.Services;

public class DocumentTextExtractorService : IDocumentTextExtractor
{
    private readonly IBlobStorageService _blobStorageService;
    private readonly ILogger<DocumentTextExtractorService> _logger;

    public DocumentTextExtractorService(IBlobStorageService blobStorageService, ILogger<DocumentTextExtractorService> logger)
    {
        _blobStorageService = blobStorageService;
        _logger = logger;
    }

    public async Task<string> ExtractTextAsync(string blobUrl, string contentType, CancellationToken cancellationToken = default)
    {
        try
        {
            var stream = await _blobStorageService.DownloadAsync(blobUrl, cancellationToken);
            return contentType.ToLowerInvariant() switch
            {
                "application/pdf" => ExtractFromPdf(stream),
                "application/vnd.openxmlformats-officedocument.wordprocessingml.document" => await ExtractFromDocxAsync(stream),
                _ => await ExtractFromTextAsync(stream)
            };
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to extract text from document: {BlobUrl}", blobUrl);
            return string.Empty;
        }
    }

    private static string ExtractFromPdf(Stream stream)
    {
        using var ms = new MemoryStream();
        stream.CopyTo(ms);
        ms.Position = 0;

        using var pdf = PdfDocument.Open(ms);
        var sb = new StringBuilder();
        foreach (var page in pdf.GetPages())
            sb.AppendLine(page.Text);

        return sb.ToString();
    }

    private static async Task<string> ExtractFromDocxAsync(Stream stream)
    {
        using var ms = new MemoryStream();
        await stream.CopyToAsync(ms);
        ms.Position = 0;

        using var wordDoc = WordprocessingDocument.Open(ms, false);
        var body = wordDoc.MainDocumentPart?.Document?.Body;
        if (body == null) return string.Empty;

        var sb = new StringBuilder();
        foreach (var para in body.Descendants<Paragraph>())
            sb.AppendLine(para.InnerText);

        return sb.ToString();
    }

    private static async Task<string> ExtractFromTextAsync(Stream stream)
    {
        using var reader = new StreamReader(stream, Encoding.UTF8);
        return await reader.ReadToEndAsync();
    }
}
