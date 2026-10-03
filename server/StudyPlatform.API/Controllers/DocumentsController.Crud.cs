using Microsoft.AspNetCore.Mvc;
using StudyPlatform.API.Extensions;
using StudyPlatform.Application.Common;
using StudyPlatform.Application.Documents.Commands;
using StudyPlatform.Application.Documents.DTOs;
using StudyPlatform.Application.Documents.Queries;
using StudyPlatform.Application.Services;

namespace StudyPlatform.API.Controllers;

// Document CRUD: list, get, upload, delete, update, move, file download.
public partial class DocumentsController
{
    // Upload allowlists — keep in sync with packages/core/src/documentUpload.ts
    // (the web `accept` attribute and the rn document picker). Every entry must
    // have a route through DocumentTextExtractorService: a dedicated extractor,
    // or the raw-UTF-8 fallback for text-shaped formats.
    private static readonly HashSet<string> AllowedUploadTypes = new(StringComparer.OrdinalIgnoreCase)
    {
        "application/pdf", "text/plain", "text/markdown", "text/x-markdown",
        // Word
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.template",
        "application/vnd.ms-word.document.macroEnabled.12",
        "application/vnd.ms-word.template.macroEnabled.12",
        "application/x-abiword",
        // PowerPoint
        "application/vnd.ms-powerpoint",
        "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        "application/vnd.openxmlformats-officedocument.presentationml.template",
        "application/vnd.openxmlformats-officedocument.presentationml.slideshow",
        "application/vnd.ms-powerpoint.presentation.macroEnabled.12",
        "application/vnd.ms-powerpoint.template.macroEnabled.12",
        "application/vnd.ms-powerpoint.slideshow.macroEnabled.12",
        // Excel
        "application/vnd.ms-excel",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.template",
        "application/vnd.ms-excel.sheet.macroEnabled.12",
        "application/vnd.ms-excel.template.macroEnabled.12",
        // OpenDocument / StarOffice
        "application/vnd.oasis.opendocument.text",
        "application/vnd.oasis.opendocument.presentation",
        "application/vnd.oasis.opendocument.spreadsheet",
        "application/vnd.oasis.opendocument.graphics",
        "application/vnd.oasis.opendocument.text-template",
        "application/vnd.oasis.opendocument.presentation-template",
        "application/vnd.oasis.opendocument.spreadsheet-template",
        "application/vnd.oasis.opendocument.graphics-template",
        "application/vnd.oasis.opendocument.text-flat-xml",
        "application/vnd.oasis.opendocument.presentation-flat-xml",
        "application/vnd.oasis.opendocument.spreadsheet-flat-xml",
        "application/vnd.sun.xml.writer", "application/vnd.sun.xml.impress",
        "application/vnd.sun.xml.calc",
        // XPS / Visio
        "application/vnd.ms-xpsdocument", "application/oxps",
        "application/vnd.ms-visio.drawing",
        // Email
        "message/rfc822", "multipart/related", "application/vnd.ms-outlook",
        // eBooks
        "application/epub+zip", "application/x-mobipocket-ebook",
        "application/vnd.amazon.ebook", "application/vnd.amazon.mobi8-ebook",
        "application/vnd.palm", "application/x-fictionbook+xml",
        // Apple iWork
        "application/vnd.apple.pages", "application/vnd.apple.keynote", "application/vnd.apple.numbers",
        // Rich text / markup / data
        "application/rtf", "text/rtf",
        "text/html", "application/xhtml+xml",
        "text/csv", "text/tab-separated-values",
        "application/json", "application/x-ipynb+json",
        "application/x-ndjson", "application/jsonl",
        "text/xml", "application/xml", "text/yaml", "application/x-yaml",
        "application/x-plist", "application/rss+xml", "application/atom+xml",
        "application/x-tex", "text/x-tex",
        // Subtitles / captions
        "application/x-subrip", "text/vtt", "application/ttml+xml",
        // Source code — only the types browsers actually report
        "text/css", "text/javascript", "application/javascript", "application/x-sh",
        "text/x-python", "text/x-c", "text/x-c++src", "text/x-java-source",
        "application/x-httpd-php", "application/sql",
        // Images
        "image/png", "image/jpeg", "image/jpg", "image/gif",
        "image/webp", "image/heic", "image/heif", "image/bmp", "image/x-ms-bmp",
        "image/svg+xml",
        // Some browsers/OSes send a generic type for .pptx/.epub uploads;
        // accept these and rely on the extension allowlist.
        "application/zip", "application/octet-stream",
    };

    private static readonly HashSet<string> AllowedUploadExtensions = new(StringComparer.OrdinalIgnoreCase)
    {
        // PDF & word processing
        ".pdf", ".docx", ".doc", ".docm", ".dotx", ".dotm", ".dot", ".rtf", ".abw",
        ".txt", ".md", ".markdown", ".mdx", ".mdown", ".mkd", ".qmd", ".rmd",
        // Presentations
        ".ppt", ".pptx", ".pptm", ".potx", ".potm", ".pps", ".ppsx", ".ppsm", ".pot",
        // Spreadsheets
        ".xls", ".xlsx", ".xlsm", ".xlt", ".xltx", ".xltm",
        // OpenDocument / StarOffice (zipped and flat XML)
        ".odt", ".odp", ".ods", ".odg", ".ott", ".otp", ".ots", ".otg",
        ".fodt", ".fodp", ".fods", ".sxw", ".sxi", ".sxc",
        // eBooks
        ".epub", ".mobi", ".azw", ".azw3", ".prc", ".pdb", ".fb2",
        // Apple iWork
        ".pages", ".key", ".numbers",
        // Fixed-layout & diagrams
        ".xps", ".oxps", ".vsdx",
        // Email
        ".eml", ".mhtml", ".mht", ".msg",
        // Markup & prose
        ".html", ".htm", ".xhtml", ".tex", ".ltx", ".sty", ".cls", ".bib", ".bbl",
        ".rst", ".adoc", ".asciidoc", ".org", ".textile", ".wiki", ".mediawiki",
        ".log", ".nfo", ".ini", ".toml", ".cfg", ".conf", ".properties",
        // Data & notebooks
        ".csv", ".tsv", ".json", ".jsonl", ".ndjson", ".json5", ".jsonc",
        ".xml", ".yaml", ".yml", ".plist", ".opml", ".rss", ".atom", ".ipynb",
        // Subtitles & captions
        ".srt", ".vtt", ".ass", ".ssa", ".sub", ".smi", ".sbv", ".lrc", ".ttml", ".dfxp",
        // Source code (extracted as plain text)
        ".py", ".pyi", ".js", ".jsx", ".mjs", ".cjs", ".ts", ".tsx", ".mts", ".cts",
        ".vue", ".svelte", ".astro", ".coffee",
        ".java", ".kt", ".kts", ".scala", ".sbt", ".groovy", ".gradle",
        ".c", ".h", ".cpp", ".cc", ".cxx", ".hpp", ".hh", ".hxx", ".m", ".mm",
        ".cs", ".vb", ".fs", ".fsx", ".go", ".rs", ".swift", ".dart",
        ".rb", ".rake", ".gemspec", ".php", ".phtml", ".pl", ".pm", ".lua", ".r", ".jl",
        ".sql", ".sh", ".bash", ".zsh", ".fish", ".ps1", ".psm1", ".bat", ".cmd", ".awk",
        ".ex", ".exs", ".erl", ".hrl", ".hs", ".clj", ".cljs", ".cljc", ".edn",
        ".ml", ".mli", ".elm", ".rkt", ".scm", ".lisp", ".el", ".tcl", ".vim",
        ".nim", ".zig", ".d", ".pas", ".f90", ".f95", ".for", ".asm", ".s", ".ino",
        ".sol", ".tf", ".tfvars", ".hcl", ".proto", ".graphql", ".gql", ".avsc",
        ".cmake", ".mk", ".nix",
        ".css", ".scss", ".sass", ".less", ".styl",
        ".erb", ".ejs", ".hbs", ".mustache", ".jinja", ".j2", ".twig", ".liquid",
        ".pug", ".haml", ".slim",
        // Images (AI OCR; SVG is read as XML text)
        ".png", ".jpg", ".jpeg", ".jfif", ".gif", ".webp", ".heic", ".heif",
        ".bmp", ".dib", ".svg",
    };

    /// <summary>
    /// Get all documents in a course
    /// </summary>
    [HttpGet]
    [ProducesResponseType(typeof(BaseResponse<IEnumerable<DocumentDto>>), 200)]
    public async Task<IActionResult> GetDocuments(Guid courseId)
    {
        var userId = User.GetUserId();
        var result = await _mediator.Send(new GetDocumentsByCourseQuery(courseId, userId));
        if (!result.IsSuccess)
            return NotFound(BaseResponse<IEnumerable<DocumentDto>>.Fail(result.Message, result.ErrorCode));

        return Ok(BaseResponse<IEnumerable<DocumentDto>>.Ok(result.Data!));
    }

    /// <summary>
    /// Get a document by ID
    /// </summary>
    [HttpGet("{documentId:guid}")]
    [ProducesResponseType(typeof(BaseResponse<DocumentDto>), 200)]
    [ProducesResponseType(typeof(BaseResponse), 404)]
    public async Task<IActionResult> GetDocument(Guid courseId, Guid documentId)
    {
        var userId = User.GetUserId();
        var result = await _mediator.Send(new GetDocumentByIdQuery(documentId, userId));
        if (!result.IsSuccess)
            return NotFound(BaseResponse<DocumentDto>.Fail(result.Message, result.ErrorCode));

        return Ok(BaseResponse<DocumentDto>.Ok(result.Data!));
    }

    /// <summary>
    /// Upload a document to a course
    /// </summary>
    [HttpPost("upload")]
    [ProducesResponseType(typeof(BaseResponse<DocumentDto>), 201)]
    [ProducesResponseType(typeof(BaseResponse), 400)]
    [RequestSizeLimit(52428800)] // 50MB
    public async Task<IActionResult> UploadDocument(Guid courseId, IFormFile file)
    {
        if (file == null || file.Length == 0)
            return BadRequest(BaseResponse<DocumentDto>.Fail("No file provided.", "NO_FILE"));

        // Browsers report wildly inconsistent (often empty) MIME types for the
        // less common formats, so a match on either the type or the extension
        // allowlist is enough.
        var extension = Path.GetExtension(file.FileName).ToLowerInvariant();
        var contentType = file.ContentType;
        var typeAllowed = contentType is not null && AllowedUploadTypes.Contains(contentType);
        if (!typeAllowed && !AllowedUploadExtensions.Contains(extension))
            return BadRequest(BaseResponse<DocumentDto>.Fail(
                "File type not supported. Allowed: documents (PDF, Office, OpenDocument/StarOffice, iWork, AbiWord, XPS, Visio), text/markup, data (CSV/JSON/XML/YAML/TOML), notebooks, subtitles and captions, source code, eBooks (EPUB/MOBI/AZW/FB2), email (EML/MHTML/MSG), and images.",
                "INVALID_FILE_TYPE"));

        var userId = User.GetUserId();
        using var stream = file.OpenReadStream();
        var result = await _mediator.Send(new UploadDocumentCommand(
            courseId, userId, file.FileName, file.ContentType, file.Length, stream));

        if (!result.IsSuccess)
        {
            if (result.ErrorCode == "STORAGE_ERROR")
                return StatusCode(StatusCodes.Status503ServiceUnavailable, BaseResponse<DocumentDto>.Fail(result.Message, result.ErrorCode));
            if (result.ErrorCode == "DUPLICATE_DOCUMENT")
                return Conflict(BaseResponse<DocumentDto>.Fail(result.Message, result.ErrorCode));

            return BadRequest(BaseResponse<DocumentDto>.Fail(result.Message, result.ErrorCode));
        }

        return CreatedAtAction(nameof(GetDocument), new { courseId, documentId = result.Data!.DocumentId },
            BaseResponse<DocumentDto>.Ok(result.Data!, result.Message));
    }

    /// <summary>
    /// Delete a document
    /// </summary>
    [HttpDelete("{documentId:guid}")]
    [ProducesResponseType(typeof(BaseResponse), 200)]
    [ProducesResponseType(typeof(BaseResponse), 404)]
    public async Task<IActionResult> DeleteDocument(Guid courseId, Guid documentId)
    {
        var userId = User.GetUserId();
        var result = await _mediator.Send(new DeleteDocumentCommand(documentId, userId));
        if (!result.IsSuccess)
            return NotFound(new BaseResponse { Success = false, Message = result.Message, ErrorCode = result.ErrorCode });

        return Ok(new BaseResponse { Success = true, Message = result.Message });
    }

    /// <summary>
    /// Update document metadata
    /// </summary>
    [HttpPatch("{documentId:guid}")]
    [ProducesResponseType(typeof(BaseResponse<DocumentDto>), 200)]
    [ProducesResponseType(typeof(BaseResponse), 404)]
    public async Task<IActionResult> UpdateDocument(Guid courseId, Guid documentId, [FromBody] UpdateDocumentRequest request)
    {
        var userId = User.GetUserId();
        var result = await _mediator.Send(new UpdateDocumentCommand(documentId, userId, request.FileName));
        if (!result.IsSuccess)
        {
            if (result.ErrorCode == "DOCUMENT_NOT_FOUND")
                return NotFound(BaseResponse<DocumentDto>.Fail(result.Message, result.ErrorCode));
            return BadRequest(BaseResponse<DocumentDto>.Fail(result.Message, result.ErrorCode));
        }

        return Ok(BaseResponse<DocumentDto>.Ok(result.Data!));
    }

    /// <summary>
    /// Move a document to a different course
    /// </summary>
    [HttpPatch("{documentId:guid}/move")]
    [ProducesResponseType(typeof(BaseResponse<DocumentDto>), 200)]
    [ProducesResponseType(typeof(BaseResponse), 404)]
    public async Task<IActionResult> MoveDocument(Guid courseId, Guid documentId, [FromBody] MoveCourseRequest request)
    {
        var userId = User.GetUserId();
        var result = await _mediator.Send(new MoveDocumentCommand(documentId, userId, request.TargetCourseId));
        if (!result.IsSuccess)
            return NotFound(BaseResponse<DocumentDto>.Fail(result.Message, result.ErrorCode));

        return Ok(BaseResponse<DocumentDto>.Ok(result.Data!));
    }

    /// <summary>
    /// Stream the raw file content for a document (used by the viewer)
    /// </summary>
    [HttpGet("{documentId:guid}/file")]
    [Produces("application/octet-stream")]
    public async Task<IActionResult> GetDocumentFile(Guid courseId, Guid documentId)
    {
        var userId = User.GetUserId();
        var result = await _mediator.Send(new GetDocumentByIdQuery(documentId, userId));
        if (!result.IsSuccess)
            return NotFound();

        var stream = await _blobStorageService.DownloadAsync(result.Data!.BlobUrl);
        return File(stream, result.Data!.ContentType, enableRangeProcessing: true);
    }

    /// <summary>
    /// Get the extracted plain-text content for a document (used by the viewer for
    /// formats that cannot be rendered in the browser, e.g. PPTX and EPUB).
    /// </summary>
    [HttpGet("{documentId:guid}/text")]
    [Produces("text/plain")]
    public async Task<IActionResult> GetDocumentText(
        Guid courseId,
        Guid documentId,
        [FromServices] IDocumentTextProvider textProvider,
        CancellationToken cancellationToken)
    {
        var userId = User.GetUserId();
        var document = await _unitOfWork.Documents.GetByIdAsync(documentId, cancellationToken);
        if (document == null || document.UserId != userId)
            return NotFound();

        // Goes through the text provider rather than re-extracting: it returns the one stored copy,
        // which is also what citation offsets index into. Re-extracting here would hand the viewer a
        // different string for PDFs and images, whose extraction falls back to AI transcription.
        var text = await textProvider.GetTextAsync(document, cancellationToken);
        return Content(text ?? string.Empty, "text/plain; charset=utf-8");
    }

    /// <summary>
    /// Get a short-lived presigned URL for a document (used by clients that need to
    /// open/stream the file directly, e.g. the mobile app's audio player and file viewer).
    /// </summary>
    [HttpGet("{documentId:guid}/download-url")]
    [ProducesResponseType(typeof(BaseResponse<string>), 200)]
    [ProducesResponseType(typeof(BaseResponse), 404)]
    public async Task<IActionResult> GetDocumentDownloadUrl(Guid courseId, Guid documentId)
    {
        var userId = User.GetUserId();
        var result = await _mediator.Send(new GetDocumentDownloadUrlQuery(documentId, userId));
        if (!result.IsSuccess)
            return NotFound(BaseResponse<string>.Fail(result.Message, result.ErrorCode));

        return Ok(BaseResponse<string>.Ok(result.Data!));
    }

}
