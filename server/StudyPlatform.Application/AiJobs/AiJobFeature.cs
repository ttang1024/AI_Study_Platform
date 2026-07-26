using MediatR;
using Microsoft.Extensions.Logging;
using StudyPlatform.Application.Common;
using StudyPlatform.Application.Services;
using StudyPlatform.Application.Documents.Commands;
using StudyPlatform.Domain.Entities;
using StudyPlatform.Domain.Interfaces;

namespace StudyPlatform.Application.AiJobs;

// ── DTOs ──────────────────────────────────────────────────────────────────────

public record AiJobDto(
    Guid Id,
    string JobType,
    Guid DocumentId,
    string Status,
    string? Error,
    DateTime CreatedAt,
    DateTime? StartedAt,
    DateTime? CompletedAt)
{
    public bool IsTerminal => Status is AiJobStatus.Succeeded or AiJobStatus.Failed;
}

public static class AiJobMapping
{
    public static AiJobDto ToDto(this AiJob job) => new(
        job.AiJobId,
        job.JobType,
        job.DocumentId,
        job.Status,
        job.Error,
        job.CreatedAt,
        job.StartedAt,
        job.CompletedAt);
}

// ── Commands / queries ────────────────────────────────────────────────────────

/// <summary>Queues a generation, or hands back the job already in flight for the same artifact.</summary>
public record RequestAiJobCommand(Guid UserId, Guid DocumentId, string JobType, string? Difficulty)
    : IRequest<Result<AiJobDto>>;

public record GetAiJobQuery(Guid UserId, Guid JobId) : IRequest<Result<AiJobDto>>;

/// <summary>Runs a queued job. Sent by the queue's background worker, never by a controller.</summary>
public record RunAiJobCommand(Guid JobId) : IRequest<Result>;

// ── Handlers ──────────────────────────────────────────────────────────────────

public class RequestAiJobCommandHandler : IRequestHandler<RequestAiJobCommand, Result<AiJobDto>>
{
    private static readonly HashSet<string> SupportedTypes =
        [AiJobType.Flashcards, AiJobType.Quiz, AiJobType.Glossary];

    private readonly IUnitOfWork _unitOfWork;

    public RequestAiJobCommandHandler(IUnitOfWork unitOfWork) => _unitOfWork = unitOfWork;

    public async Task<Result<AiJobDto>> Handle(RequestAiJobCommand request, CancellationToken cancellationToken)
    {
        if (!SupportedTypes.Contains(request.JobType))
            return Result<AiJobDto>.Failure($"Unsupported job type '{request.JobType}'.", "UNSUPPORTED_JOB_TYPE");

        var document = await _unitOfWork.Documents.GetByIdAsync(request.DocumentId, cancellationToken);
        if (document == null || document.UserId != request.UserId)
            return Result<AiJobDto>.Failure("Document not found.", "DOCUMENT_NOT_FOUND");

        // Double-clicking "Generate" shouldn't pay for the same generation twice.
        var inFlight = await _unitOfWork.AiJobs.GetActiveAsync(
            request.UserId, request.DocumentId, request.JobType, cancellationToken);
        if (inFlight != null)
            return Result<AiJobDto>.Success(inFlight.ToDto(), "Generation already in progress.");

        var job = new AiJob
        {
            AiJobId = Guid.NewGuid(),
            UserId = request.UserId,
            DocumentId = request.DocumentId,
            JobType = request.JobType,
            Difficulty = request.Difficulty,
            Status = AiJobStatus.Queued,
            CreatedAt = DateTime.UtcNow,
        };

        await _unitOfWork.AiJobs.AddAsync(job, cancellationToken);
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        return Result<AiJobDto>.Success(job.ToDto(), "Generation queued.");
    }
}

public class GetAiJobQueryHandler : IRequestHandler<GetAiJobQuery, Result<AiJobDto>>
{
    private readonly IUnitOfWork _unitOfWork;

    public GetAiJobQueryHandler(IUnitOfWork unitOfWork) => _unitOfWork = unitOfWork;

    public async Task<Result<AiJobDto>> Handle(GetAiJobQuery request, CancellationToken cancellationToken)
    {
        var job = await _unitOfWork.AiJobs.GetByIdAsync(request.JobId, cancellationToken);
        if (job == null || job.UserId != request.UserId)
            return Result<AiJobDto>.Failure("Job not found.", "JOB_NOT_FOUND");

        return Result<AiJobDto>.Success(job.ToDto());
    }
}

/// <summary>
/// Delegates to the same generation commands the synchronous endpoints use, so there is exactly one
/// implementation of each generation. Those commands are already idempotent — they return existing
/// artifacts rather than regenerating — which makes a retried job cheap.
/// </summary>
public class RunAiJobCommandHandler : IRequestHandler<RunAiJobCommand, Result>
{
    private readonly IUnitOfWork _unitOfWork;
    private readonly IMediator _mediator;
    private readonly ILogger<RunAiJobCommandHandler> _logger;

    private readonly IInstanceIdentity _instance;

    public RunAiJobCommandHandler(
        IUnitOfWork unitOfWork,
        IMediator mediator,
        IInstanceIdentity instance,
        ILogger<RunAiJobCommandHandler> logger)
    {
        _unitOfWork = unitOfWork;
        _mediator = mediator;
        _instance = instance;
        _logger = logger;
    }

    public async Task<Result> Handle(RunAiJobCommand request, CancellationToken cancellationToken)
    {
        var job = await _unitOfWork.AiJobs.GetByIdAsync(request.JobId, cancellationToken);
        if (job == null)
            return Result.Failure("Job not found.", "JOB_NOT_FOUND");

        job.Status = AiJobStatus.Running;
        job.StartedAt = DateTime.UtcNow;

        // Stamped at claim time, which is when ownership becomes real: this is the instance holding
        // the job's in-memory credentials, and therefore the only one that can run it.
        job.OwnerInstanceId = _instance.Id;
        _unitOfWork.AiJobs.Update(job);
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        try
        {
            var result = await RunAsync(job, cancellationToken);
            await CompleteAsync(job, result.IsSuccess, result.Message, cancellationToken);
            return result.IsSuccess ? Result.Success() : Result.Failure(result.Message, "GENERATION_FAILED");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "AI job {JobId} ({JobType}) failed", job.AiJobId, job.JobType);
            await CompleteAsync(job, succeeded: false, ex.Message, cancellationToken);
            return Result.Failure(ex.Message, "GENERATION_FAILED");
        }
    }

    private async Task<(bool IsSuccess, string Message)> RunAsync(AiJob job, CancellationToken cancellationToken)
    {
        switch (job.JobType)
        {
            case AiJobType.Flashcards:
            {
                var r = await _mediator.Send(new GenerateFlashcardsCommand(job.DocumentId, job.UserId), cancellationToken);
                return (r.IsSuccess, r.Message);
            }
            case AiJobType.Quiz:
            {
                var r = await _mediator.Send(
                    new GenerateQuizCommand(job.DocumentId, job.UserId, job.Difficulty ?? "medium"), cancellationToken);
                return (r.IsSuccess, r.Message);
            }
            case AiJobType.Glossary:
            {
                var r = await _mediator.Send(new GenerateGlossaryCommand(job.DocumentId, job.UserId), cancellationToken);
                return (r.IsSuccess, r.Message);
            }
            default:
                return (false, $"Unsupported job type '{job.JobType}'.");
        }
    }

    private async Task CompleteAsync(AiJob job, bool succeeded, string? message, CancellationToken cancellationToken)
    {
        job.Status = succeeded ? AiJobStatus.Succeeded : AiJobStatus.Failed;
        job.Error = succeeded ? null : Truncate(message, 2000);
        job.CompletedAt = DateTime.UtcNow;
        _unitOfWork.AiJobs.Update(job);
        await _unitOfWork.SaveChangesAsync(cancellationToken);
    }

    private static string? Truncate(string? value, int max)
        => value == null || value.Length <= max ? value : value[..max];
}
