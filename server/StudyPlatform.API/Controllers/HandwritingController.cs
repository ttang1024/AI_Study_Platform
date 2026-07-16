using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using StudyPlatform.API.Extensions;
using StudyPlatform.Application.Common;
using StudyPlatform.Application.Documents.DTOs;
using StudyPlatform.Application.Practice;

namespace StudyPlatform.API.Controllers;

/// <summary>
/// Grades photographed handwritten work — a worked maths or physics solution — and reports where the
/// reasoning first broke, rather than just whether the final answer matched.
/// </summary>
[ApiController]
[Route("api/handwriting")]
[Authorize]
public class HandwritingController : ControllerBase
{
    private readonly IMediator _mediator;

    public HandwritingController(IMediator mediator) => _mediator = mediator;

    /// <param name="Pages">
    /// Base64 photos of the work, in order. Several pages are graded as one continuous solution.
    /// </param>
    /// <param name="Problem">
    /// The problem being solved. Optional — the model will read it off the page if it's written there —
    /// but supplying it makes the grade markedly more reliable.
    /// </param>
    public record GradeRequest(List<ChatAttachmentDto> Pages, string? Problem);

    [HttpPost("grade")]
    [ProducesResponseType(typeof(BaseResponse<HandwritingGradeDto>), 200)]
    [ProducesResponseType(typeof(BaseResponse), 400)]
    public async Task<IActionResult> Grade([FromBody] GradeRequest request, CancellationToken cancellationToken)
    {
        List<(byte[] data, string mimeType, string? fileName)> pages;
        try
        {
            pages = ChatAttachments.Decode(request.Pages);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(BaseResponse<HandwritingGradeDto>.Fail(ex.Message, "INVALID_ATTACHMENT"));
        }

        if (pages.Count == 0)
            return BadRequest(BaseResponse<HandwritingGradeDto>.Fail(
                "At least one photo of the work is required.", "NO_PAGES"));

        // Images only. The OpenAI-compatible providers silently drop non-image attachments, so a PDF
        // would come back "graded" against nothing at all — better to say no up front.
        var notImage = pages.FirstOrDefault(p => !p.mimeType.StartsWith("image/"));
        if (notImage.mimeType != null)
            return BadRequest(BaseResponse<HandwritingGradeDto>.Fail(
                $"Handwriting grading takes photos, not {notImage.mimeType}. Attach an image of the work.",
                "UNSUPPORTED_PAGE_TYPE"));

        var result = await _mediator.Send(
            new GradeHandwrittenWorkCommand(
                User.GetUserId(),
                pages.Select(p => (p.data, p.mimeType)).ToList(),
                request.Problem),
            cancellationToken);

        if (!result.IsSuccess)
        {
            if (AiErrorMapper.TryGetAiError(result.Message, out _, out _))
                return AiErrorMapper.ToObjectResult<HandwritingGradeDto>(this, result.Message);

            return BadRequest(BaseResponse<HandwritingGradeDto>.Fail(result.Message, result.ErrorCode));
        }

        return Ok(BaseResponse<HandwritingGradeDto>.Ok(result.Data!, result.Message));
    }
}
