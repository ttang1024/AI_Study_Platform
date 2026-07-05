using System.IO.Compression;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
using System.Xml.Linq;
using DocumentFormat.OpenXml.Packaging;
using DocumentFormat.OpenXml.Wordprocessing;
using DrawingText = DocumentFormat.OpenXml.Drawing.Text;
using Spreadsheet = DocumentFormat.OpenXml.Spreadsheet;
using HtmlAgilityPack;
using Microsoft.Extensions.Logging;
using StudyPlatform.Application.Common;
using StudyPlatform.Application.Services;
using UglyToad.PdfPig;

namespace StudyPlatform.Infrastructure.Services;

public class DocumentTextExtractorService : IDocumentTextExtractor
{
    private readonly IBlobStorageService _blobStorageService;
    private readonly IAiService _aiService;
    private readonly ILogger<DocumentTextExtractorService> _logger;

    public DocumentTextExtractorService(
        IBlobStorageService blobStorageService,
        IAiService aiService,
        ILogger<DocumentTextExtractorService> logger)
    {
        _blobStorageService = blobStorageService;
        _aiService = aiService;
        _logger = logger;
    }

    public async Task<string> ExtractTextAsync(string blobUrl, string contentType, CancellationToken cancellationToken = default)
    {
        try
        {
            var stream = await _blobStorageService.DownloadAsync(blobUrl, cancellationToken);
            using var ms = new MemoryStream();
            await stream.CopyToAsync(ms, cancellationToken);
            var data = ms.ToArray();

            var normalizedType = contentType.ToLowerInvariant();
            // Browsers report generic or empty content types for many formats,
            // so the file extension carried in the blob URL is the primary key.
            var extension = Path.GetExtension(blobUrl).ToLowerInvariant();

            // SVG is XML with a text layer, not a raster image — keep it out of
            // the OCR path.
            if (extension is ".svg" || normalizedType is "image/svg+xml")
                return ExtractFromSvg(data);

            if (normalizedType.StartsWith("image/") || ImageExtensions.Contains(extension))
                return await OcrWithAiAsync(data, NormalizeImageMime(normalizedType, extension), cancellationToken);

            if (extension is ".pdf" || normalizedType is "application/pdf")
                return await ExtractFromPdfWithOcrFallbackAsync(data, cancellationToken);

            return extension switch
            {
                ".docx" or ".docm" or ".dotx" => ExtractFromDocx(data),
                ".doc" => LegacyOfficeTextExtractor.ExtractDocText(data),
                ".pptx" or ".pptm" or ".potx" => ExtractFromPptx(data),
                ".ppt" => LegacyOfficeTextExtractor.ExtractPptText(data),
                ".xlsx" or ".xlsm" => ExtractFromXlsx(data),
                ".xls" => LegacyOfficeTextExtractor.ExtractXlsText(data),
                ".odt" or ".odp" or ".ods" => ExtractFromOpenDocument(data),
                ".epub" => ExtractFromEpub(data),
                ".mobi" => ExtractFromMobi(data),
                ".fb2" => ExtractFromFictionBook(data),
                ".pages" or ".key" or ".numbers" => ExtractFromIWork(data),
                ".xps" or ".oxps" => ExtractFromXps(data),
                ".vsdx" => ExtractFromVisio(data),
                ".eml" => EmailTextExtractor.ExtractEml(data),
                ".mhtml" or ".mht" => EmailTextExtractor.ExtractMhtml(data),
                ".msg" => EmailTextExtractor.ExtractMsg(data),
                ".rtf" => RtfTextStripper.ToPlainText(Encoding.UTF8.GetString(data)),
                ".html" or ".htm" or ".xhtml" or ".smi" => ExtractFromHtml(Encoding.UTF8.GetString(data)),
                ".ipynb" => ExtractFromNotebook(data),
                ".srt" or ".vtt" => ExtractFromSubtitles(Encoding.UTF8.GetString(data)),
                ".ass" or ".ssa" => ExtractFromAssSubtitles(Encoding.UTF8.GetString(data)),
                ".sub" => ExtractFromMicroDvdSubtitles(Encoding.UTF8.GetString(data)),
                _ => ExtractByMime(normalizedType, data),
            };
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to extract text from document: {BlobUrl}", blobUrl);
            return string.Empty;
        }
    }

    // Fallback dispatch for blob URLs without a usable extension.
    private string ExtractByMime(string normalizedType, byte[] data) => normalizedType switch
    {
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            or "application/vnd.ms-word.document.macroEnabled.12"
            or "application/vnd.openxmlformats-officedocument.wordprocessingml.template" => ExtractFromDocx(data),
        "application/msword" => LegacyOfficeTextExtractor.ExtractDocText(data),
        "application/vnd.openxmlformats-officedocument.presentationml.presentation"
            or "application/vnd.ms-powerpoint.presentation.macroEnabled.12"
            or "application/vnd.openxmlformats-officedocument.presentationml.template" => ExtractFromPptx(data),
        "application/vnd.ms-powerpoint" => LegacyOfficeTextExtractor.ExtractPptText(data),
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            or "application/vnd.ms-excel.sheet.macroEnabled.12" => ExtractFromXlsx(data),
        "application/vnd.ms-excel" => LegacyOfficeTextExtractor.ExtractXlsText(data),
        "application/vnd.ms-xpsdocument" or "application/oxps" => ExtractFromXps(data),
        "application/vnd.ms-visio.drawing" => ExtractFromVisio(data),
        "application/x-fictionbook+xml" => ExtractFromFictionBook(data),
        "message/rfc822" => EmailTextExtractor.ExtractEml(data),
        "application/vnd.ms-outlook" => EmailTextExtractor.ExtractMsg(data),
        "application/vnd.oasis.opendocument.text"
            or "application/vnd.oasis.opendocument.presentation"
            or "application/vnd.oasis.opendocument.spreadsheet" => ExtractFromOpenDocument(data),
        "application/epub+zip" => ExtractFromEpub(data),
        "application/x-mobipocket-ebook" => ExtractFromMobi(data),
        "application/vnd.apple.pages" or "application/vnd.apple.keynote" or "application/vnd.apple.numbers" => ExtractFromIWork(data),
        "application/rtf" or "text/rtf" => RtfTextStripper.ToPlainText(Encoding.UTF8.GetString(data)),
        "text/html" or "application/xhtml+xml" => ExtractFromHtml(Encoding.UTF8.GetString(data)),
        "application/x-ipynb+json" => ExtractFromNotebook(data),
        "application/x-subrip" or "text/vtt" => ExtractFromSubtitles(Encoding.UTF8.GetString(data)),
        _ => Encoding.UTF8.GetString(data),
    };

    // ── AI OCR (scanned PDFs and images) ──────────────────────────────────

    private static readonly string[] ImageExtensions =
        [".png", ".jpg", ".jpeg", ".gif", ".webp", ".heic", ".heif", ".bmp"];

    private static string NormalizeImageMime(string contentType, string extension)
    {
        if (contentType.StartsWith("image/"))
            return contentType == "image/jpg" ? "image/jpeg" : contentType;
        return extension switch
        {
            ".png" => "image/png",
            ".jpg" or ".jpeg" => "image/jpeg",
            ".gif" => "image/gif",
            ".webp" => "image/webp",
            ".heic" => "image/heic",
            ".heif" => "image/heif",
            ".bmp" => "image/bmp",
            _ => "image/png",
        };
    }

    private async Task<string> ExtractFromPdfWithOcrFallbackAsync(byte[] data, CancellationToken cancellationToken)
    {
        var text = ExtractFromPdf(data);
        if (!string.IsNullOrWhiteSpace(text))
            return text;

        // No embedded text layer — likely a scanned PDF; fall back to AI OCR.
        return await OcrWithAiAsync(data, "application/pdf", cancellationToken);
    }

    private async Task<string> OcrWithAiAsync(byte[] data, string mimeType, CancellationToken cancellationToken)
    {
        if (!AiInlineData.IsSupported(mimeType))
        {
            _logger.LogWarning("AI OCR not supported for mime type {MimeType}", mimeType);
            return string.Empty;
        }

        try
        {
            return await _aiService.ExtractTextFromFileAsync(data, mimeType, cancellationToken);
        }
        catch (Exception ex)
        {
            // The AI provider is configured per request; endpoints called without
            // AI headers (e.g. the raw text viewer) simply skip OCR.
            _logger.LogWarning(ex, "AI OCR failed for mime type {MimeType}", mimeType);
            return string.Empty;
        }
    }

    // ── PDF / Office OpenXML / EPUB ───────────────────────────────────────

    private static string ExtractFromPdf(byte[] data)
    {
        using var pdf = PdfDocument.Open(data);
        var sb = new StringBuilder();
        foreach (var page in pdf.GetPages())
            sb.AppendLine(page.Text);

        return sb.ToString();
    }

    private static string ExtractFromDocx(byte[] data)
    {
        using var ms = new MemoryStream(data);
        using var wordDoc = WordprocessingDocument.Open(ms, false);
        var body = wordDoc.MainDocumentPart?.Document?.Body;
        if (body == null) return string.Empty;

        var sb = new StringBuilder();
        foreach (var para in body.Descendants<Paragraph>())
            sb.AppendLine(para.InnerText);

        return sb.ToString();
    }

    private static string ExtractFromPptx(byte[] data)
    {
        using var ms = new MemoryStream(data);
        using var presentation = PresentationDocument.Open(ms, false);
        var presentationPart = presentation.PresentationPart;
        if (presentationPart?.Presentation?.SlideIdList == null)
            return string.Empty;

        var sb = new StringBuilder();
        var slideNumber = 0;
        foreach (var slidePart in presentationPart.SlideParts)
        {
            slideNumber++;
            if (slidePart.Slide == null)
                continue;
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

    private static string ExtractFromXlsx(byte[] data)
    {
        using var ms = new MemoryStream(data);
        using var doc = SpreadsheetDocument.Open(ms, false);
        var workbookPart = doc.WorkbookPart;
        if (workbookPart == null) return string.Empty;

        var sharedStrings = workbookPart.SharedStringTablePart?.SharedStringTable;
        var sb = new StringBuilder();

        if (workbookPart.Workbook == null) return string.Empty;

        foreach (var sheet in workbookPart.Workbook.Descendants<Spreadsheet.Sheet>())
        {
            if (sheet.Id?.Value == null) continue;
            if (workbookPart.GetPartById(sheet.Id.Value) is not WorksheetPart { Worksheet: not null } worksheetPart) continue;

            sb.AppendLine($"# {sheet.Name}");
            foreach (var row in worksheetPart.Worksheet.Descendants<Spreadsheet.Row>())
            {
                var cells = row.Elements<Spreadsheet.Cell>().Select(c => GetCellText(c, sharedStrings));
                var line = string.Join("\t", cells).TrimEnd();
                if (line.Length > 0)
                    sb.AppendLine(line);
            }
            sb.AppendLine();
        }

        return sb.ToString();
    }

    private static string GetCellText(Spreadsheet.Cell cell, Spreadsheet.SharedStringTable? sharedStrings)
    {
        var value = cell.CellValue?.Text ?? cell.InnerText;
        if (cell.DataType?.Value == Spreadsheet.CellValues.SharedString &&
            sharedStrings != null && int.TryParse(value, out var index) &&
            index >= 0 && index < sharedStrings.ChildElements.Count)
            return sharedStrings.ChildElements[index].InnerText;

        return value;
    }

    private static string ExtractFromOpenDocument(byte[] data)
    {
        using var ms = new MemoryStream(data);
        using var archive = new ZipArchive(ms, ZipArchiveMode.Read);
        var entry = archive.GetEntry("content.xml");
        if (entry == null) return string.Empty;

        using var entryStream = entry.Open();
        var xdoc = XDocument.Load(entryStream);
        XNamespace textNs = "urn:oasis:names:tc:opendocument:xmlns:text:1.0";

        var sb = new StringBuilder();
        foreach (var element in xdoc.Descendants().Where(e => e.Name == textNs + "p" || e.Name == textNs + "h"))
        {
            var text = element.Value.Trim();
            if (text.Length > 0)
                sb.AppendLine(text);
        }

        return sb.ToString();
    }

    private static string ExtractFromEpub(byte[] data)
    {
        using var ms = new MemoryStream(data);
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
            using var entryStream = entry.Open();
            using var reader = new StreamReader(entryStream, Encoding.UTF8);
            var html = reader.ReadToEnd();

            var text = ExtractFromHtml(html);
            if (string.IsNullOrWhiteSpace(text))
                continue;

            sb.AppendLine(text.Trim());
            sb.AppendLine();
        }

        return sb.ToString();
    }

    private static string ExtractFromMobi(byte[] data)
    {
        var html = MobiTextExtractor.ExtractRawText(data);
        if (string.IsNullOrWhiteSpace(html))
            return string.Empty;

        // MOBI book text is HTML markup.
        return ExtractFromHtml(html);
    }

    // iWork bundles (.pages/.key/.numbers) are zip archives. The binary IWA
    // body is proprietary, but documents saved with a preview carry a
    // QuickLook PDF we can extract; the legacy '08/'09 format has index.xml.
    private static string ExtractFromIWork(byte[] data)
    {
        using var ms = new MemoryStream(data);
        using var archive = new ZipArchive(ms, ZipArchiveMode.Read);

        var preview = archive.Entries.FirstOrDefault(e =>
            e.FullName.EndsWith("Preview.pdf", StringComparison.OrdinalIgnoreCase) ||
            e.FullName.EndsWith("Preview.pdf.gz", StringComparison.OrdinalIgnoreCase));
        if (preview != null)
        {
            using var pdfMs = new MemoryStream();
            using var previewStream = preview.FullName.EndsWith(".gz", StringComparison.OrdinalIgnoreCase)
                ? (Stream)new GZipStream(preview.Open(), CompressionMode.Decompress)
                : preview.Open();
            previewStream.CopyTo(pdfMs);
            return ExtractFromPdf(pdfMs.ToArray());
        }

        var index = archive.Entries.FirstOrDefault(e =>
            e.FullName.Equals("index.xml", StringComparison.OrdinalIgnoreCase) ||
            e.FullName.Equals("index.xml.gz", StringComparison.OrdinalIgnoreCase));
        if (index != null)
        {
            using var indexStream = index.FullName.EndsWith(".gz", StringComparison.OrdinalIgnoreCase)
                ? (Stream)new GZipStream(index.Open(), CompressionMode.Decompress)
                : index.Open();
            var xdoc = XDocument.Load(indexStream);
            return string.Join("\n",
                xdoc.Descendants()
                    .Where(e => !e.HasElements)
                    .Select(e => e.Value.Trim())
                    .Where(v => v.Length > 0));
        }

        return string.Empty;
    }

    // ── XML-based formats (SVG, FictionBook, XPS, Visio) ──────────────────

    private static string ExtractFromSvg(byte[] data)
    {
        using var ms = new MemoryStream(data);
        var xdoc = XDocument.Load(ms);
        var lines = xdoc.Descendants()
            .Where(e => e.Name.LocalName is "text" or "title" or "desc")
            .Select(e => e.Value.Trim())
            .Where(v => v.Length > 0);
        return string.Join("\n", lines);
    }

    private static string ExtractFromFictionBook(byte[] data)
    {
        using var ms = new MemoryStream(data);
        var xdoc = XDocument.Load(ms);
        var lines = xdoc.Descendants()
            .Where(e => e.Name.LocalName is "book-title" or "p" or "v" or "subtitle")
            .Select(e => e.Value.Trim())
            .Where(v => v.Length > 0);
        return string.Join("\n", lines);
    }

    // XPS pages are FixedPage XML parts; text is carried in the
    // UnicodeString attribute of Glyphs elements.
    private static string ExtractFromXps(byte[] data)
    {
        using var ms = new MemoryStream(data);
        using var archive = new ZipArchive(ms, ZipArchiveMode.Read);

        var pages = archive.Entries
            .Where(e => e.FullName.EndsWith(".fpage", StringComparison.OrdinalIgnoreCase))
            .OrderBy(e => Path.GetDirectoryName(e.FullName), StringComparer.OrdinalIgnoreCase)
            .ThenBy(e => LeadingNumber(Path.GetFileNameWithoutExtension(e.FullName)));

        var sb = new StringBuilder();
        foreach (var page in pages)
        {
            using var pageStream = page.Open();
            var xdoc = XDocument.Load(pageStream);
            var texts = xdoc.Descendants()
                .Where(e => e.Name.LocalName == "Glyphs")
                .Select(e => e.Attribute("UnicodeString")?.Value?.Trim())
                .Where(v => !string.IsNullOrEmpty(v));

            var pageText = string.Join(" ", texts).Trim();
            if (pageText.Length == 0)
                continue;

            sb.AppendLine(pageText);
            sb.AppendLine();
        }

        return sb.ToString();
    }

    private static string ExtractFromVisio(byte[] data)
    {
        using var ms = new MemoryStream(data);
        using var archive = new ZipArchive(ms, ZipArchiveMode.Read);

        var pages = archive.Entries
            .Where(e => e.FullName.StartsWith("visio/pages/", StringComparison.OrdinalIgnoreCase)
                        && e.FullName.EndsWith(".xml", StringComparison.OrdinalIgnoreCase)
                        && !e.FullName.EndsWith("pages.xml", StringComparison.OrdinalIgnoreCase))
            .OrderBy(e => LeadingNumber(Path.GetFileNameWithoutExtension(e.FullName)));

        var sb = new StringBuilder();
        foreach (var page in pages)
        {
            using var pageStream = page.Open();
            var xdoc = XDocument.Load(pageStream);
            foreach (var text in xdoc.Descendants().Where(e => e.Name.LocalName == "Text"))
            {
                var value = text.Value.Trim();
                if (value.Length > 0)
                    sb.AppendLine(value);
            }
        }

        return sb.ToString();
    }

    // "page12" → 12; used for natural page ordering inside zip packages.
    private static int LeadingNumber(string name)
    {
        var match = Regex.Match(name, @"\d+");
        return match.Success && int.TryParse(match.Value, out var n) ? n : int.MaxValue;
    }

    // ── Markup / notebook / subtitle formats ──────────────────────────────

    internal static string ExtractFromHtml(string html)
    {
        var doc = new HtmlDocument();
        doc.LoadHtml(html);

        foreach (var node in doc.DocumentNode.Descendants()
                     .Where(n => n.Name is "script" or "style").ToList())
            node.Remove();

        var text = HtmlEntity.DeEntitize(doc.DocumentNode.InnerText);
        // Collapse the whitespace runs left behind by removed markup.
        text = Regex.Replace(text, @"[ \t]+", " ");
        text = Regex.Replace(text, @"(\s*\n){3,}", "\n\n");
        return text.Trim();
    }

    private static string ExtractFromNotebook(byte[] data)
    {
        using var doc = JsonDocument.Parse(data);
        if (!doc.RootElement.TryGetProperty("cells", out var cells) || cells.ValueKind != JsonValueKind.Array)
            return Encoding.UTF8.GetString(data);

        var sb = new StringBuilder();
        foreach (var cell in cells.EnumerateArray())
        {
            var cellType = cell.TryGetProperty("cell_type", out var t) ? t.GetString() : null;
            if (!cell.TryGetProperty("source", out var source))
                continue;

            var text = source.ValueKind switch
            {
                JsonValueKind.Array => string.Concat(source.EnumerateArray().Select(s => s.GetString())),
                JsonValueKind.String => source.GetString() ?? string.Empty,
                _ => string.Empty,
            };
            if (string.IsNullOrWhiteSpace(text))
                continue;

            if (cellType == "code")
            {
                sb.AppendLine("```");
                sb.AppendLine(text.TrimEnd());
                sb.AppendLine("```");
            }
            else
            {
                sb.AppendLine(text.TrimEnd());
            }
            sb.AppendLine();
        }

        return sb.ToString();
    }

    // Advanced SubStation Alpha: dialogue text is the 10th comma-separated
    // field of "Dialogue:" lines; {\...} override tags are styling.
    private static string ExtractFromAssSubtitles(string raw)
    {
        var sb = new StringBuilder();
        string? previous = null;
        foreach (var rawLine in raw.Split('\n'))
        {
            var line = rawLine.Trim();
            if (!line.StartsWith("Dialogue:", StringComparison.OrdinalIgnoreCase))
                continue;

            var fields = line.Split(',', 10);
            if (fields.Length < 10)
                continue;

            var text = Regex.Replace(fields[9], @"\{[^}]*\}", string.Empty)
                .Replace("\\N", "\n").Replace("\\n", "\n").Replace("\\h", " ")
                .Trim();
            if (text.Length == 0 || text == previous)
                continue;

            sb.AppendLine(text);
            previous = text;
        }

        return sb.ToString();
    }

    // MicroDVD ({start}{end}Text|Text2) and SubViewer ([hh:mm:ss] timing lines).
    private static string ExtractFromMicroDvdSubtitles(string raw)
    {
        var sb = new StringBuilder();
        string? previous = null;
        foreach (var rawLine in raw.Split('\n'))
        {
            var line = rawLine.Trim();
            if (line.Length == 0 || (line.StartsWith('[') && line.EndsWith(']')))
                continue;

            line = Regex.Replace(line, @"^(\{[^}]*\})+", string.Empty)
                .Replace("|", "\n")
                .Trim();
            if (line.Length == 0 || Regex.IsMatch(line, @"^[\d:.,\s>-]+$") || line == previous)
                continue;

            sb.AppendLine(line);
            previous = line;
        }

        return sb.ToString();
    }

    private static string ExtractFromSubtitles(string raw)
    {
        var sb = new StringBuilder();
        string? previous = null;
        foreach (var rawLine in raw.Split('\n'))
        {
            var line = rawLine.Trim();
            if (line.Length == 0 ||
                line.Contains("-->") ||
                line.Equals("WEBVTT", StringComparison.OrdinalIgnoreCase) ||
                line.StartsWith("NOTE", StringComparison.Ordinal) ||
                line.StartsWith("STYLE", StringComparison.Ordinal) ||
                line.StartsWith("REGION", StringComparison.Ordinal) ||
                int.TryParse(line, out _))
                continue;

            // Strip inline markup (<i>, <c.color>, speaker <v Name> tags…).
            line = Regex.Replace(line, "<[^>]*>", string.Empty).Trim();
            if (line.Length == 0 || line == previous)
                continue;

            sb.AppendLine(line);
            previous = line;
        }

        return sb.ToString();
    }
}
