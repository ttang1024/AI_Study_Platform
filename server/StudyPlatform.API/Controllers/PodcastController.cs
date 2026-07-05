using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using StudyPlatform.API.Extensions;
using StudyPlatform.Application.Common;
using StudyPlatform.Application.Documents.DTOs;
using StudyPlatform.Application.Documents.Queries;
using StudyPlatform.Application.Podcasts.Commands;
using StudyPlatform.Application.Podcasts.Queries;
using StudyPlatform.Application.Services;

namespace StudyPlatform.API.Controllers;

public record CreatePodcastRequest(string? Url, Guid CourseId, string? ApplePodcastsUrl = null)
{
    /// <summary>Episode URL; falls back to the legacy Apple-only field name for older clients.</summary>
    public string? EpisodeUrl => Url ?? ApplePodcastsUrl;
}

public record CreatePodcastFromFeedRequest(string FeedUrl, string EpisodeId, Guid CourseId);

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
    /// Create a podcast episode from an episode page URL (Apple Podcasts, Overcast,
    /// Castro, Podbean, …) or a direct audio file URL
    /// </summary>
    [HttpPost]
    [ProducesResponseType(typeof(BaseResponse<DocumentDto>), 201)]
    [ProducesResponseType(typeof(BaseResponse), 400)]
    public async Task<IActionResult> CreatePodcast([FromBody] CreatePodcastRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.EpisodeUrl))
            return BadRequest(BaseResponse<DocumentDto>.Fail("Podcast episode URL is required.", "MISSING_URL"));

        var userId = User.GetUserId();
        var result = await _mediator.Send(new CreatePodcastEpisodeCommand(userId, request.CourseId, request.EpisodeUrl));
        if (!result.IsSuccess)
            return BadRequest(BaseResponse<DocumentDto>.Fail(result.Message, result.ErrorCode));

        return StatusCode(201, BaseResponse<DocumentDto>.Ok(result.Data!, result.Message));
    }

    /// <summary>
    /// List the episodes of a podcast RSS feed so the user can pick one
    /// </summary>
    [HttpGet("feed")]
    [ProducesResponseType(typeof(BaseResponse<PodcastFeedInfo>), 200)]
    [ProducesResponseType(typeof(BaseResponse), 400)]
    public async Task<IActionResult> GetFeed([FromQuery] string url)
    {
        if (string.IsNullOrWhiteSpace(url))
            return BadRequest(BaseResponse<PodcastFeedInfo>.Fail("Feed URL is required.", "MISSING_URL"));

        var result = await _mediator.Send(new GetPodcastFeedQuery(url));
        if (!result.IsSuccess)
            return BadRequest(BaseResponse<PodcastFeedInfo>.Fail(result.Message, result.ErrorCode));

        return Ok(BaseResponse<PodcastFeedInfo>.Ok(result.Data!));
    }

    /// <summary>
    /// Create a podcast episode picked from an RSS feed
    /// </summary>
    [HttpPost("from-feed")]
    [ProducesResponseType(typeof(BaseResponse<DocumentDto>), 201)]
    [ProducesResponseType(typeof(BaseResponse), 400)]
    public async Task<IActionResult> CreateFromFeed([FromBody] CreatePodcastFromFeedRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.FeedUrl) || string.IsNullOrWhiteSpace(request.EpisodeId))
            return BadRequest(BaseResponse<DocumentDto>.Fail("Feed URL and episode ID are required.", "MISSING_URL"));

        var userId = User.GetUserId();
        var result = await _mediator.Send(new CreatePodcastFromFeedCommand(userId, request.CourseId, request.FeedUrl, request.EpisodeId));
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
