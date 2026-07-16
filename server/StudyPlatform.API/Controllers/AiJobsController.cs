using System.Text.Json;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using StudyPlatform.API.Extensions;
using StudyPlatform.API.Services;
using StudyPlatform.Application.AiJobs;

namespace StudyPlatform.API.Controllers;

/// <summary>
/// Deferred AI generation. Generating flashcards, a quiz or a glossary from a long document takes tens
/// of seconds — too long to hold a request open — so the client queues a job here and then either
/// polls it or watches /stream, and refetches the artifact once the job succeeds.
/// </summary>
[ApiController]
[Route("api/ai-jobs")]
[Authorize]
public class AiJobsController : ControllerBase
{
    /// <summary>How often the SSE endpoint re-reads the job's status.</summary>
    private static readonly TimeSpan PollInterval = TimeSpan.FromSeconds(2);

    /// <summary>
    /// Ceiling on how long one SSE connection is held open. Generation should finish long before this;
    /// the cap stops a wedged job from pinning a connection forever. Clients reconnect if they need to.
    /// </summary>
    private static readonly TimeSpan StreamTimeout = TimeSpan.FromMinutes(10);

    private readonly IMediator _mediator;
    private readonly AiJobQueue _queue;

    public AiJobsController(IMediator mediator, AiJobQueue queue)
    {
        _mediator = mediator;
        _queue = queue;
    }

    public record CreateAiJobRequest(Guid DocumentId, string JobType, string? Difficulty);

    /// <summary>Queues a generation and returns the job to track. 202 — the work has not run yet.</summary>
    [HttpPost]
    [ProducesResponseType(StatusCodes.Status202Accepted)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Create([FromBody] CreateAiJobRequest request, CancellationToken cancellationToken)
    {
        // Capture before queueing: a bad/missing key must fail here, while the user is still watching.
        var credentials = this.CaptureAiCredentials();

        var result = await _mediator.Send(
            new RequestAiJobCommand(User.GetUserId(), request.DocumentId, request.JobType, request.Difficulty),
            cancellationToken);

        if (!result.IsSuccess)
            return result.ErrorCode == "DOCUMENT_NOT_FOUND" ? NotFound(result) : BadRequest(result);

        // A job already in flight is not re-enqueued — TryEnqueue dedupes by id.
        _queue.TryEnqueue(result.Data!.Id, credentials);

        return Accepted(result);
    }

    [HttpGet("{jobId:guid}")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Get(Guid jobId, CancellationToken cancellationToken)
    {
        var result = await _mediator.Send(new GetAiJobQuery(User.GetUserId(), jobId), cancellationToken);
        return result.IsSuccess ? Ok(result) : NotFound(result);
    }

    /// <summary>
    /// Pushes the job's status to the client until it reaches a terminal state, so the UI can show live
    /// progress instead of hammering the poll endpoint.
    /// </summary>
    [HttpGet("{jobId:guid}/stream")]
    public async Task<IActionResult> Stream(Guid jobId, CancellationToken cancellationToken)
    {
        var userId = User.GetUserId();

        var initial = await _mediator.Send(new GetAiJobQuery(userId, jobId), cancellationToken);
        if (!initial.IsSuccess)
            return NotFound(initial);

        Response.SetSseHeaders();

        using var timeout = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
        timeout.CancelAfter(StreamTimeout);
        var token = timeout.Token;

        var lastStatus = string.Empty;
        try
        {
            while (!token.IsCancellationRequested)
            {
                var result = await _mediator.Send(new GetAiJobQuery(userId, jobId), token);
                if (!result.IsSuccess)
                    break;

                var job = result.Data!;

                // Only speak up when something actually changed — an unchanged status is not news.
                if (job.Status != lastStatus)
                {
                    lastStatus = job.Status;
                    await Response.WriteSseJsonAsync(job, token);
                }

                if (job.IsTerminal)
                    break;

                await Task.Delay(PollInterval, token);
            }
        }
        catch (OperationCanceledException)
        {
            // Client hung up, or the stream hit its ceiling. Either way there is nothing left to say.
            return new EmptyResult();
        }

        await Response.WriteSseDoneAsync(CancellationToken.None);
        return new EmptyResult();
    }
}
