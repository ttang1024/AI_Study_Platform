using MediatR;
using StudyPlatform.Application.Common;
using StudyPlatform.Application.WorkedProblems.Commands;
using StudyPlatform.Application.WorkedProblems.DTOs;
using StudyPlatform.Domain.Interfaces;

namespace StudyPlatform.Application.WorkedProblems.Queries;

// ── Get Worked Problems ───────────────────────────────────────────────────────

public record GetWorkedProblemsQuery(Guid UserId, Guid? DocumentId, Guid? VideoId) : IRequest<Result<IEnumerable<WorkedProblemDto>>>;

public class GetWorkedProblemsQueryHandler : IRequestHandler<GetWorkedProblemsQuery, Result<IEnumerable<WorkedProblemDto>>>
{
    private readonly IUnitOfWork _unitOfWork;

    public GetWorkedProblemsQueryHandler(IUnitOfWork unitOfWork)
    {
        _unitOfWork = unitOfWork;
    }

    public async Task<Result<IEnumerable<WorkedProblemDto>>> Handle(GetWorkedProblemsQuery request, CancellationToken cancellationToken)
    {
        var problems = await _unitOfWork.WorkedProblems.GetByUserAsync(
            request.UserId, request.DocumentId, request.VideoId, cancellationToken);
        return Result<IEnumerable<WorkedProblemDto>>.Success(
            problems.Select(GenerateWorkedProblemsCommandHandler.ToDto));
    }
}

// ── Get Problem Attempts ──────────────────────────────────────────────────────

public record GetProblemAttemptsQuery(Guid UserId, Guid ProblemId) : IRequest<Result<IEnumerable<WorkedProblemAttemptDto>>>;

public class GetProblemAttemptsQueryHandler : IRequestHandler<GetProblemAttemptsQuery, Result<IEnumerable<WorkedProblemAttemptDto>>>
{
    private readonly IUnitOfWork _unitOfWork;

    public GetProblemAttemptsQueryHandler(IUnitOfWork unitOfWork)
    {
        _unitOfWork = unitOfWork;
    }

    public async Task<Result<IEnumerable<WorkedProblemAttemptDto>>> Handle(GetProblemAttemptsQuery request, CancellationToken cancellationToken)
    {
        var attempts = await _unitOfWork.WorkedProblemAttempts.GetByProblemAsync(
            request.ProblemId, request.UserId, cancellationToken);
        var dtos = attempts.Select(a => new WorkedProblemAttemptDto(
            a.WorkedProblemAttemptId, a.WorkedProblemId,
            a.UserAnswer, a.AiEvaluation, a.IsCorrect, a.AttemptedAt));
        return Result<IEnumerable<WorkedProblemAttemptDto>>.Success(dtos);
    }
}
