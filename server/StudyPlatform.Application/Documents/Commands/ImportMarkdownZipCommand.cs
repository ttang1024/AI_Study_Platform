using System.IO.Compression;
using System.Text.RegularExpressions;
using MediatR;
using StudyPlatform.Application.Common;
using StudyPlatform.Application.Services;
using StudyPlatform.Domain.Entities;
using StudyPlatform.Domain.Interfaces;

namespace StudyPlatform.Application.Documents.Commands;

public record ImportMarkdownZipCommand(
    byte[] ZipData,
    Guid UserId,
    Guid? CourseId) : IRequest<Result<ImportResultDto>>;

public record ImportResultDto(int ImportedCount, IEnumerable<string> FileNames);

public class ImportMarkdownZipCommandHandler : IRequestHandler<ImportMarkdownZipCommand, Result<ImportResultDto>>
{
    private static readonly Regex WikiLinkRegex = new(@"\[\[([^\]]+)\]\]", RegexOptions.Compiled);
    private static readonly Regex FrontMatterRegex = new(@"^---\s*\n.*?\n---\s*\n", RegexOptions.Compiled | RegexOptions.Singleline);

    private readonly IUnitOfWork _unitOfWork;
    private readonly IBlobStorageService _blobStorageService;

    public ImportMarkdownZipCommandHandler(IUnitOfWork unitOfWork, IBlobStorageService blobStorageService)
    {
        _unitOfWork = unitOfWork;
        _blobStorageService = blobStorageService;
    }

    public async Task<Result<ImportResultDto>> Handle(ImportMarkdownZipCommand request, CancellationToken cancellationToken)
    {
        if (request.ZipData == null || request.ZipData.Length == 0)
            return Result<ImportResultDto>.Failure("No zip data provided.", "NO_DATA");

        // Need a course to attach documents to
        Guid courseId;
        if (request.CourseId.HasValue)
        {
            courseId = request.CourseId.Value;
        }
        else
        {
            // Use first available course for the user
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
            if (!entry.Name.EndsWith(".md", StringComparison.OrdinalIgnoreCase))
                continue;

            using var reader = new System.IO.StreamReader(entry.Open());
            var raw = await reader.ReadToEndAsync(cancellationToken);

            // Strip YAML frontmatter
            var cleaned = FrontMatterRegex.Replace(raw, string.Empty);
            // Strip wiki-links (keep display text)
            cleaned = WikiLinkRegex.Replace(cleaned, m =>
            {
                var inner = m.Groups[1].Value;
                // [[Link|Display]] → Display, [[Link]] → Link
                var pipeIdx = inner.IndexOf('|');
                return pipeIdx >= 0 ? inner[(pipeIdx + 1)..] : inner;
            });

            var fileName = entry.Name;
            var contentBytes = System.Text.Encoding.UTF8.GetBytes(cleaned);
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
