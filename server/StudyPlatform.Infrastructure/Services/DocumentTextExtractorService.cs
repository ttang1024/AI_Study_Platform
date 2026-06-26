using System.IO.Compression;
using System.Text;
using DocumentFormat.OpenXml.Packaging;
using DocumentFormat.OpenXml.Wordprocessing;
using DrawingText = DocumentFormat.OpenXml.Drawing.Text;
using HtmlAgilityPack;
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
            var normalizedType = contentType.ToLowerInvariant();

            // Some PPTX/EPUB uploads arrive with a generic content type, so fall
            // back to the file extension carried in the blob URL when needed.
            if (normalizedType is "application/zip" or "application/octet-stream")
                normalizedType = GuessTypeFromUrl(blobUrl) ?? normalizedType;

            return normalizedType switch
            {
                "application/pdf" => ExtractFromPdf(stream),
                "application/vnd.openxmlformats-officedocument.wordprocessingml.document" => await ExtractFromDocxAsync(stream),
                "application/vnd.openxmlformats-officedocument.presentationml.presentation" => await ExtractFromPptxAsync(stream),
                "application/epub+zip" => await ExtractFromEpubAsync(stream),
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

    private static async Task<string> ExtractFromPptxAsync(Stream stream)
    {
        using var ms = new MemoryStream();
        await stream.CopyToAsync(ms);
        ms.Position = 0;

        using var presentation = PresentationDocument.Open(ms, false);
        var presentationPart = presentation.PresentationPart;
        if (presentationPart?.Presentation?.SlideIdList == null)
            return string.Empty;

        var sb = new StringBuilder();
        var slideNumber = 0;
        foreach (var slidePart in presentationPart.SlideParts)
        {
            slideNumber++;
            var texts = slidePart.Slide.Descendants<DrawingText>()
                .Select(t => t.Text)
                .Where(t => !string.IsNullOrWhiteSpace(t));

            var slideText = string.Join(" ", texts).Trim();
            if (slideText.Length == 0)
                continue;

            sb.AppendLine($"# Slide {slideNumber}");
            sb.AppendLine(slideText);
            sb.AppendLine();
        }

        return sb.ToString();
    }

    private static async Task<string> ExtractFromEpubAsync(Stream stream)
    {
        using var ms = new MemoryStream();
        await stream.CopyToAsync(ms);
        ms.Position = 0;

        using var archive = new ZipArchive(ms, ZipArchiveMode.Read);
        var sb = new StringBuilder();

        // EPUB content lives in XHTML/HTML documents inside the zip. Read them in
        // a stable (name) order and strip the markup with HtmlAgilityPack.
        var contentEntries = archive.Entries
            .Where(e => e.FullName.EndsWith(".xhtml", StringComparison.OrdinalIgnoreCase)
                        || e.FullName.EndsWith(".html", StringComparison.OrdinalIgnoreCase)
                        || e.FullName.EndsWith(".htm", StringComparison.OrdinalIgnoreCase))
            .OrderBy(e => e.FullName, StringComparer.OrdinalIgnoreCase);

        foreach (var entry in contentEntries)
        {
            await using var entryStream = entry.Open();
            using var reader = new StreamReader(entryStream, Encoding.UTF8);
            var html = await reader.ReadToEndAsync();

            var doc = new HtmlDocument();
            doc.LoadHtml(html);
            var text = doc.DocumentNode.InnerText;
            if (string.IsNullOrWhiteSpace(text))
                continue;

            sb.AppendLine(HtmlEntity.DeEntitize(text).Trim());
            sb.AppendLine();
        }

        return sb.ToString();
    }

    private static async Task<string> ExtractFromTextAsync(Stream stream)
    {
        using var reader = new StreamReader(stream, Encoding.UTF8);
        return await reader.ReadToEndAsync();
    }

    private static string? GuessTypeFromUrl(string blobUrl)
    {
        var extension = Path.GetExtension(blobUrl).ToLowerInvariant();
        return extension switch
        {
            ".pptx" => "application/vnd.openxmlformats-officedocument.presentationml.presentation",
            ".epub" => "application/epub+zip",
            ".docx" => "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            ".pdf" => "application/pdf",
            _ => null
        };
    }
}
