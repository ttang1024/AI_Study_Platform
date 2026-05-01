using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using StudyPlatform.API.Extensions;
using StudyPlatform.Application.Common;
using StudyPlatform.Application.Documents.Commands;

namespace StudyPlatform.API.Controllers;

[ApiController]
[Route("api/documents/import")]
[Authorize]
[Produces("application/json")]
public class ImportController : ControllerBase
{
    private readonly IMediator _mediator;

    public ImportController(IMediator mediator)
    {
        _mediator = mediator;
    }

    /// <summary>
    /// Import Obsidian/Markdown notes from a .zip file
    /// </summary>
    [HttpPost("markdown-zip")]
    [RequestSizeLimit(52428800)] // 50 MB
    [ProducesResponseType(typeof(BaseResponse<ImportResultDto>), 200)]
    [ProducesResponseType(typeof(BaseResponse), 400)]
    public async Task<IActionResult> ImportMarkdownZip(
        IFormFile zipFile,
        [FromForm] Guid? courseId,
        CancellationToken cancellationToken)
    {
        if (zipFile == null || zipFile.Length == 0)
            return BadRequest(BaseResponse<ImportResultDto>.Fail("No file provided.", "NO_FILE"));

        if (!zipFile.FileName.EndsWith(".zip", StringComparison.OrdinalIgnoreCase))
            return BadRequest(BaseResponse<ImportResultDto>.Fail("Only .zip files are accepted.", "INVALID_FILE_TYPE"));

        var userId = User.GetUserId();
        using var ms = new MemoryStream();
        await zipFile.CopyToAsync(ms, cancellationToken);

        var result = await _mediator.Send(
            new ImportMarkdownZipCommand(ms.ToArray(), userId, courseId),
            cancellationToken);

        if (!result.IsSuccess)
            return BadRequest(BaseResponse<ImportResultDto>.Fail(result.Message, result.ErrorCode));

        return Ok(BaseResponse<ImportResultDto>.Ok(result.Data!, $"Imported {result.Data!.ImportedCount} documents."));
    }

    /// <summary>
    /// Import Notion export (HTML) from a .zip file
    /// </summary>
    [HttpPost("notion")]
    [RequestSizeLimit(52428800)] // 50 MB
    [ProducesResponseType(typeof(BaseResponse<ImportResultDto>), 200)]
    [ProducesResponseType(typeof(BaseResponse), 400)]
    public async Task<IActionResult> ImportNotion(
        IFormFile zipFile,
        [FromForm] Guid? courseId,
        CancellationToken cancellationToken)
    {
        if (zipFile == null || zipFile.Length == 0)
            return BadRequest(BaseResponse<ImportResultDto>.Fail("No file provided.", "NO_FILE"));

        if (!zipFile.FileName.EndsWith(".zip", StringComparison.OrdinalIgnoreCase))
            return BadRequest(BaseResponse<ImportResultDto>.Fail("Only .zip files are accepted.", "INVALID_FILE_TYPE"));

        var userId = User.GetUserId();
        using var ms = new MemoryStream();
        await zipFile.CopyToAsync(ms, cancellationToken);

        var result = await _mediator.Send(
            new ImportNotionHtmlCommand(ms.ToArray(), userId, courseId),
            cancellationToken);

        if (!result.IsSuccess)
            return BadRequest(BaseResponse<ImportResultDto>.Fail(result.Message, result.ErrorCode));

        return Ok(BaseResponse<ImportResultDto>.Ok(result.Data!, $"Imported {result.Data!.ImportedCount} documents."));
    }
}
