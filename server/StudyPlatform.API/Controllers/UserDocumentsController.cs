using System.Text;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SmartReader;
using StudyPlatform.API.Extensions;
using StudyPlatform.API.Services;
using StudyPlatform.Application.Common;
using StudyPlatform.Application.Documents.Commands;
using StudyPlatform.Application.Documents.DTOs;
using StudyPlatform.Application.Documents.Queries;

namespace StudyPlatform.API.Controllers;

[ApiController]
[Route("api/documents")]
[Authorize]
[Produces("application/json")]
public class UserDocumentsController : ControllerBase
{
    private readonly IMediator _mediator;
    private readonly ILogger<UserDocumentsController> _logger;

    public UserDocumentsController(IMediator mediator, ILogger<UserDocumentsController> logger)
    {
        _mediator = mediator;
        _logger = logger;
    }

    /// <summary>
    /// Clip a web article URL and save it as a document
    /// </summary>
    [HttpPost("clip-url")]
    [ProducesResponseType(typeof(BaseResponse<DocumentDto>), 201)]
    [ProducesResponseType(typeof(BaseResponse), 400)]
    public async Task<IActionResult> ClipUrl(
        [FromBody] ClipUrlRequest request,
        [FromServices] IHttpClientFactory httpClientFactory,
        CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.Url))
            return BadRequest(BaseResponse<DocumentDto>.Fail("URL is required.", "URL_REQUIRED"));

        if (!Guid.TryParse(request.CourseId, out var courseId))
            return BadRequest(BaseResponse<DocumentDto>.Fail("A valid course must be selected.", "COURSE_REQUIRED"));

        string html;
        try
        {
            var client = httpClientFactory.CreateClient("WebClipper");
            using var response = await client.GetAsync(request.Url, cancellationToken);
            response.EnsureSuccessStatusCode();
            html = await response.Content.ReadAsStringAsync(cancellationToken);
        }
        catch (Exception ex)
        {
            return BadRequest(BaseResponse<DocumentDto>.Fail($"Failed to fetch URL: {ex.Message}", "URL_FETCH_FAILED"));
        }

        _logger.LogDebug("HTML fetched: length={Length}, preview={Preview}",
            html.Length, html.Length > 300 ? html[..300] : html);

        var reader = new Reader(request.Url, html)
        {
            ContinueIfNotReadable = true
        };
        var article = reader.GetArticle();

        _logger.LogDebug("SmartReader: IsReadable={IsReadable}, Title={Title}, ContentLength={ContentLength}",
            article.IsReadable, article.Title, article.Content?.Length ?? 0);

        string title, markdown;
        if (!string.IsNullOrWhiteSpace(article.Content))
        {
            // SmartReader successfully extracted clean article HTML
            title = !string.IsNullOrWhiteSpace(article.Title) ? article.Title : "Clipped Article";
            markdown = WebClipHtmlConverter.ConvertHtmlToMarkdown(article.Content);
        }
        else
        {
            // SmartReader couldn't extract content — try __NEXT_DATA__ JSON first (Next.js sites),
            // then fall back to regex extraction on the raw HTML.
            _logger.LogDebug("SmartReader returned empty content, trying __NEXT_DATA__ extraction");
            var (nextTitle, nextContent) = WebClipHtmlConverter.ExtractFromNextData(html);
            if (!string.IsNullOrWhiteSpace(nextContent))
            {
                _logger.LogDebug("__NEXT_DATA__ extraction succeeded, content length={Length}", nextContent.Length);
                title = nextTitle ?? (!string.IsNullOrWhiteSpace(article.Title) ? article.Title : WebClipHtmlConverter.ExtractTitleFallback(html));
                markdown = WebClipHtmlConverter.ConvertHtmlToMarkdown(nextContent);
            }
            else
            {
                _logger.LogDebug("__NEXT_DATA__ not found, falling back to regex extraction");
                title = !string.IsNullOrWhiteSpace(article.Title) ? article.Title : WebClipHtmlConverter.ExtractTitleFallback(html);
                markdown = WebClipHtmlConverter.ExtractAndConvertFallback(html);
            }
        }

        if (string.IsNullOrWhiteSpace(markdown))
            return BadRequest(BaseResponse<DocumentDto>.Fail("No readable content found at the provided URL.", "NO_CONTENT"));
        var fileName = WebClipHtmlConverter.SanitizeFileName(title) + ".md";
        var bytes = Encoding.UTF8.GetBytes(markdown);
        using var stream = new MemoryStream(bytes);

        var userId = User.GetUserId();
        var result = await _mediator.Send(new ClipUrlCommand(courseId, userId, fileName, stream, bytes.Length, "text/markdown", request.Url), cancellationToken);

        if (!result.IsSuccess)
            return BadRequest(BaseResponse<DocumentDto>.Fail(result.Message, result.ErrorCode));

        return StatusCode(201, BaseResponse<DocumentDto>.Ok(result.Data!, result.Message));
    }

    /// <summary>
    /// Get all documents for the authenticated user with pagination
    /// </summary>
    [HttpGet]
    [ProducesResponseType(typeof(BaseResponse<PaginatedList<DocumentDto>>), 200)]
    public async Task<IActionResult> GetAllDocuments(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 50,
        [FromQuery] Guid? courseId = null)
    {
        var userId = User.GetUserId();
        var result = await _mediator.Send(new GetAllDocumentsQuery(userId, page, pageSize, courseId));
        return Ok(BaseResponse<PaginatedList<DocumentDto>>.Ok(result.Data!));
    }
}
