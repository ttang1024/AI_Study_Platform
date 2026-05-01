using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using StudyPlatform.API.Extensions;
using StudyPlatform.Application.Common;
using StudyPlatform.Application.Documents.DTOs;
using StudyPlatform.Application.Documents.Queries;
using StudyPlatform.Application.Podcasts.Commands;

namespace StudyPlatform.API.Controllers;

public record CreatePodcastRequest(string ApplePodcastsUrl, Guid CourseId);

[ApiController]
[Route("api/podcasts")]
[Authorize]
[Produces("application/json")]
public class PodcastController : ControllerBase
{
    private readonly IMediator _mediator;

    public PodcastController(IMediator mediator)
    {
        _mediator = mediator;
    }

    /// <summary>
    /// Create a podcast episode from an Apple Podcasts URL
    /// </summary>
    [HttpPost]
    [ProducesResponseType(typeof(BaseResponse<DocumentDto>), 201)]
    [ProducesResponseType(typeof(BaseResponse), 400)]
    public async Task<IActionResult> CreatePodcast([FromBody] CreatePodcastRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.ApplePodcastsUrl))
            return BadRequest(BaseResponse<DocumentDto>.Fail("Apple Podcasts URL is required.", "MISSING_URL"));

        var userId = User.GetUserId();
        var result = await _mediator.Send(new CreatePodcastEpisodeCommand(userId, request.CourseId, request.ApplePodcastsUrl));
        if (!result.IsSuccess)
            return BadRequest(BaseResponse<DocumentDto>.Fail(result.Message, result.ErrorCode));

        return StatusCode(201, BaseResponse<DocumentDto>.Ok(result.Data!, result.Message));
    }

    /// <summary>
    /// Get podcast episode metadata by document ID
    /// </summary>
    [HttpGet("{documentId:guid}")]
    [ProducesResponseType(typeof(BaseResponse<DocumentDto>), 200)]
    [ProducesResponseType(typeof(BaseResponse), 404)]
    public async Task<IActionResult> GetPodcast(Guid documentId)
    {
        var userId = User.GetUserId();
        var result = await _mediator.Send(new GetDocumentByIdQuery(documentId, userId));
        if (!result.IsSuccess)
            return NotFound(BaseResponse<DocumentDto>.Fail(result.Message, result.ErrorCode));

        return Ok(BaseResponse<DocumentDto>.Ok(result.Data!));
    }

    /// <summary>
    /// Get the direct audio URL for a podcast episode
    /// </summary>
    [HttpGet("{documentId:guid}/url")]
    [ProducesResponseType(typeof(BaseResponse<string>), 200)]
    [ProducesResponseType(typeof(BaseResponse), 404)]
    public async Task<IActionResult> GetPodcastUrl(Guid documentId)
    {
        var userId = User.GetUserId();
        var result = await _mediator.Send(new GetDocumentByIdQuery(documentId, userId));
        if (!result.IsSuccess)
            return NotFound(BaseResponse<string>.Fail(result.Message, result.ErrorCode));

        return Ok(BaseResponse<string>.Ok(result.Data!.BlobUrl));
    }

    /// <summary>
    /// Transcribe a podcast episode using AI
    /// </summary>
    [HttpPost("{documentId:guid}/transcribe")]
    [ProducesResponseType(typeof(BaseResponse<DocumentDto>), 200)]
    [ProducesResponseType(typeof(BaseResponse), 400)]
    public async Task<IActionResult> TranscribePodcast(Guid documentId)
    {
        var userId = User.GetUserId();
        var result = await _mediator.Send(new TranscribePodcastCommand(documentId, userId));
        if (!result.IsSuccess)
            return BadRequest(BaseResponse<DocumentDto>.Fail(result.Message, result.ErrorCode));

        return Ok(BaseResponse<DocumentDto>.Ok(result.Data!, result.Message));
    }
}
