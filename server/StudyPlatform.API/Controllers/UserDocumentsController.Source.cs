using Microsoft.AspNetCore.Mvc;
using StudyPlatform.API.Extensions;
using StudyPlatform.Application.Common;
using StudyPlatform.Application.Documents.Commands;
using StudyPlatform.Application.Documents.Queries;

namespace StudyPlatform.API.Controllers;

// The document's own text and source file, independent of the course it sits in.
//
// These live here rather than on DocumentsController because that controller is routed under
// api/courses/{courseId}/documents — a caller holding only a document id (a citation link, the
// source view) has no course id to supply.
public partial class UserDocumentsController
{
    public record RegenerateRequest(bool Flashcards = true, bool Quizzes = true, bool Glossary = true);

    /// <summary>
    /// The document's plain text — the exact string citation offsets index into, so a highlighted
    /// range lands on the passage the citation actually came from.
    /// </summary>
    [HttpGet("{id:guid}/text")]
    [ProducesResponseType(typeof(BaseResponse<DocumentTextDto>), 200)]
    [ProducesResponseType(typeof(BaseResponse), 404)]
    public async Task<IActionResult> GetText(Guid id, CancellationToken cancellationToken)
    {
        var result = await _mediator.Send(new GetDocumentTextQuery(User.GetUserId(), id), cancellationToken);

        return result.IsSuccess
            ? Ok(BaseResponse<DocumentTextDto>.Ok(result.Data!))
            : NotFound(BaseResponse<DocumentTextDto>.Fail(result.Message, result.ErrorCode));
    }

    /// <summary>
    /// How much of this document's generated material predates the current source version.
    /// </summary>
    [HttpGet("{id:guid}/staleness")]
    [ProducesResponseType(typeof(BaseResponse<StalenessDto>), 200)]
    [ProducesResponseType(typeof(BaseResponse), 404)]
    public async Task<IActionResult> GetStaleness(Guid id, CancellationToken cancellationToken)
    {
        var result = await _mediator.Send(new GetDocumentStalenessQuery(User.GetUserId(), id), cancellationToken);

        return result.IsSuccess
            ? Ok(BaseResponse<StalenessDto>.Ok(result.Data!))
            : NotFound(BaseResponse<StalenessDto>.Fail(result.Message, result.ErrorCode));
    }

    /// <summary>
    /// Replaces the document's file with a revised version. Existing artifacts are kept but marked
    /// out of date — regenerating is a separate, explicit step so nobody loses a deck's review
    /// history to a re-upload.
    /// </summary>
    [HttpPut("{id:guid}/source")]
    [ProducesResponseType(typeof(BaseResponse<StalenessDto>), 200)]
    [ProducesResponseType(typeof(BaseResponse), 400)]
    [ProducesResponseType(typeof(BaseResponse), 404)]
    [RequestSizeLimit(52428800)] // 50MB, matching the original upload endpoint
    // Bare IFormFile, no [FromForm]: the attribute combination makes Swashbuckle fail to generate
    // an operation for this action, which 500s the whole /swagger document.
    public async Task<IActionResult> ReplaceSource(
        Guid id, IFormFile file, CancellationToken cancellationToken)
    {
        if (file == null || file.Length == 0)
            return BadRequest(BaseResponse<StalenessDto>.Fail("No file supplied.", "NO_FILE"));

        await using var stream = file.OpenReadStream();

        var result = await _mediator.Send(new ReplaceDocumentSourceCommand(
            User.GetUserId(), id, stream, file.FileName, file.ContentType, file.Length), cancellationToken);

        if (!result.IsSuccess)
            return result.ErrorCode == "DOCUMENT_NOT_FOUND"
                ? NotFound(BaseResponse<StalenessDto>.Fail(result.Message, result.ErrorCode))
                : BadRequest(BaseResponse<StalenessDto>.Fail(result.Message, result.ErrorCode));

        return Ok(BaseResponse<StalenessDto>.Ok(result.Data!, result.Message));
    }

    /// <summary>
    /// Discards the out-of-date artifacts of the chosen kinds. The ordinary generate endpoints
    /// rebuild them on next request.
    /// </summary>
    [HttpPost("{id:guid}/regenerate")]
    [ProducesResponseType(typeof(BaseResponse<StalenessDto>), 200)]
    [ProducesResponseType(typeof(BaseResponse), 404)]
    public async Task<IActionResult> RegenerateStale(
        Guid id, [FromBody] RegenerateRequest request, CancellationToken cancellationToken)
    {
        var result = await _mediator.Send(new RegenerateStaleArtifactsCommand(
            User.GetUserId(), id, request.Flashcards, request.Quizzes, request.Glossary), cancellationToken);

        return result.IsSuccess
            ? Ok(BaseResponse<StalenessDto>.Ok(result.Data!, "Out-of-date material cleared; it will be rebuilt on next open."))
            : NotFound(BaseResponse<StalenessDto>.Fail(result.Message, result.ErrorCode));
    }
}
