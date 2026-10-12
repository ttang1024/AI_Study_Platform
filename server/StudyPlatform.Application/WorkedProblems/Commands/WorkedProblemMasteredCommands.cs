using MediatR;
using StudyPlatform.Application.Common;
using StudyPlatform.Domain.Entities;
using StudyPlatform.Domain.Interfaces;

namespace StudyPlatform.Application.WorkedProblems.Commands;

// ── Queries ─────────────────────────────────────────────────────────────────

public record GetMasteredProblemIdsQuery(Guid UserId) : IRequest<Result<IEnumerable<Guid>>>;

public class GetMasteredProblemIdsQueryHandler : IRequestHandler<GetMasteredProblemIdsQuery, Result<IEnumerable<Guid>>>
{
    private readonly IWorkedProblemMasteredRepository _workedProblemMastered;
    public GetMasteredProblemIdsQueryHandler(IWorkedProblemMasteredRepository workedProblemMastered) { _workedProblemMastered = workedProblemMastered; }

    public async Task<Result<IEnumerable<Guid>>> Handle(GetMasteredProblemIdsQuery request, CancellationToken cancellationToken)
    {
        var ids = await _workedProblemMastered.GetMasteredProblemIdsByUserAsync(request.UserId, cancellationToken);
        return Result<IEnumerable<Guid>>.Success(ids);
    }
}

// ── Commands ─────────────────────────────────────────────────────────────────

public record ToggleWorkedProblemMasteredCommand(Guid UserId, Guid ProblemId) : IRequest<Result<bool>>;

public class ToggleWorkedProblemMasteredCommandHandler : IRequestHandler<ToggleWorkedProblemMasteredCommand, Result<bool>>
{
    private readonly IUnitOfWork _unitOfWork;
    private readonly IWorkedProblemMasteredRepository _workedProblemMastered;
    public ToggleWorkedProblemMasteredCommandHandler(IUnitOfWork unitOfWork, IWorkedProblemMasteredRepository workedProblemMastered) { _unitOfWork = unitOfWork;
    _workedProblemMastered = workedProblemMastered; }

    public async Task<Result<bool>> Handle(ToggleWorkedProblemMasteredCommand request, CancellationToken cancellationToken)
    {
        var existing = await _workedProblemMastered.GetByUserAndProblemAsync(request.UserId, request.ProblemId, cancellationToken);
        if (existing != null)
        {
            _workedProblemMastered.Remove(existing);
            await _unitOfWork.SaveChangesAsync(cancellationToken);
            return Result<bool>.Success(false, "Problem unmarked as mastered.");
        }

        var mastered = new WorkedProblemMastered
        {
            Id = Guid.NewGuid(),
            UserId = request.UserId,
            WorkedProblemId = request.ProblemId,
            MasteredAt = DateTime.UtcNow,
        };
        await _workedProblemMastered.AddAsync(mastered, cancellationToken);
        await _unitOfWork.SaveChangesAsync(cancellationToken);
        return Result<bool>.Success(true, "Problem marked as mastered.");
    }
}
