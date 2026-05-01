using System.IO.Compression;
using System.Text;
using System.Text.RegularExpressions;
using MediatR;
using StudyPlatform.Application.Common;
using StudyPlatform.Application.Services;
using StudyPlatform.Domain.Entities;
using StudyPlatform.Domain.Interfaces;

namespace StudyPlatform.Application.Documents.Commands;

public record ImportNotionHtmlCommand(
    byte[] ZipData,
    Guid UserId,
    Guid? CourseId) : IRequest<Result<ImportResultDto>>;

public class ImportNotionHtmlCommandHandler : IRequestHandler<ImportNotionHtmlCommand, Result<ImportResultDto>>
{
    // Simple tag stripper - avoids a heavy HTML parsing dependency for basic extraction
    private static readonly Regex HtmlTagRegex = new(@"<[^>]+>", RegexOptions.Compiled);
    private static readonly Regex MultiWhitespace = new(@"\s{3,}", RegexOptions.Compiled);

    private readonly IUnitOfWork _unitOfWork;
    private readonly IBlobStorageService _blobStorageService;

    public ImportNotionHtmlCommandHandler(IUnitOfWork unitOfWork, IBlobStorageService blobStorageService)
    {
        _unitOfWork = unitOfWork;
        _blobStorageService = blobStorageService;
    }

    public async Task<Result<ImportResultDto>> Handle(ImportNotionHtmlCommand request, CancellationToken cancellationToken)
    {
        if (request.ZipData == null || request.ZipData.Length == 0)
            return Result<ImportResultDto>.Failure("No zip data provided.", "NO_DATA");

        Guid courseId;
        if (request.CourseId.HasValue)
        {
            courseId = request.CourseId.Value;
        }
        else
        {
            var courses = await _unitOfWork.Courses.GetByUserIdAsync(request.UserId, cancellationToken);
            var first = courses.FirstOrDefault();
            if (first == null)
                return Result<ImportResultDto>.Failure("No course found. Please provide a courseId or create a course first.", "NO_COURSE");
            courseId = first.CourseId;
        }

        var importedNames = new List<string>();
        using var zipStream = new MemoryStream(request.ZipData);
        using var archive = new ZipArchive(zipStream, ZipArchiveMode.Read);

        foreach (var entry in archive.Entries)
        {
            if (!entry.Name.EndsWith(".html", StringComparison.OrdinalIgnoreCase) &&
                !entry.Name.EndsWith(".htm", StringComparison.OrdinalIgnoreCase))
                continue;

            using var reader = new StreamReader(entry.Open(), Encoding.UTF8);
            var html = await reader.ReadToEndAsync(cancellationToken);

            // Try to extract the <article> or <body> content
            var bodyMatch = Regex.Match(html, @"<article[^>]*>(.*?)</article>", RegexOptions.Singleline | RegexOptions.IgnoreCase);
            if (!bodyMatch.Success)
                bodyMatch = Regex.Match(html, @"<body[^>]*>(.*?)</body>", RegexOptions.Singleline | RegexOptions.IgnoreCase);

            var bodyHtml = bodyMatch.Success ? bodyMatch.Groups[1].Value : html;

            // Strip all tags
            var text = HtmlTagRegex.Replace(bodyHtml, " ");
            // Decode HTML entities
            text = System.Net.WebUtility.HtmlDecode(text);
            // Collapse whitespace
            text = MultiWhitespace.Replace(text, "\n\n").Trim();

            var fileName = Path.ChangeExtension(entry.Name, ".md");
            var contentBytes = Encoding.UTF8.GetBytes(text);
            using var contentStream = new MemoryStream(contentBytes);

            var blobUrl = await _blobStorageService.UploadAsync(
                contentStream, fileName, "text/markdown", cancellationToken);

            var doc = new Document
            {
                DocumentId = Guid.NewGuid(),
                CourseId = courseId,
                UserId = request.UserId,
                FileName = fileName,
                BlobUrl = blobUrl,
                ContentType = "text/markdown",
                FileSize = contentBytes.Length,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow,
            };

            await _unitOfWork.Documents.AddAsync(doc, cancellationToken);
            importedNames.Add(fileName);
        }

        await _unitOfWork.SaveChangesAsync(cancellationToken);
        return Result<ImportResultDto>.Success(new ImportResultDto(importedNames.Count, importedNames));
    }
}
