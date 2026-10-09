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
