using MediatR;
using StudyPlatform.Application.Common;
using StudyPlatform.Domain.Entities;
using StudyPlatform.Domain.Interfaces;

namespace StudyPlatform.Application.Glossary.Commands;

// ── Queries ─────────────────────────────────────────────────────────────────

public record GetMasteredGlossaryIdsQuery(Guid UserId) : IRequest<Result<IEnumerable<Guid>>>;

public class GetMasteredGlossaryIdsQueryHandler : IRequestHandler<GetMasteredGlossaryIdsQuery, Result<IEnumerable<Guid>>>
{
    private readonly IGlossaryMasteredRepository _glossaryMastered;
    public GetMasteredGlossaryIdsQueryHandler(IGlossaryMasteredRepository glossaryMastered) { _glossaryMastered = glossaryMastered; }

    public async Task<Result<IEnumerable<Guid>>> Handle(GetMasteredGlossaryIdsQuery request, CancellationToken cancellationToken)
    {
        var ids = await _glossaryMastered.GetMasteredTermIdsByUserAsync(request.UserId, cancellationToken);
        return Result<IEnumerable<Guid>>.Success(ids);
    }
}

// ── Commands ─────────────────────────────────────────────────────────────────

public record ToggleGlossaryMasteredCommand(Guid UserId, Guid TermId) : IRequest<Result<bool>>;

public class ToggleGlossaryMasteredCommandHandler : IRequestHandler<ToggleGlossaryMasteredCommand, Result<bool>>
{
    private readonly IUnitOfWork _unitOfWork;
    private readonly IGlossaryMasteredRepository _glossaryMastered;
    public ToggleGlossaryMasteredCommandHandler(IUnitOfWork unitOfWork, IGlossaryMasteredRepository glossaryMastered) { _unitOfWork = unitOfWork;
    _glossaryMastered = glossaryMastered; }

    public async Task<Result<bool>> Handle(ToggleGlossaryMasteredCommand request, CancellationToken cancellationToken)
    {
        var existing = await _glossaryMastered.GetByUserAndTermAsync(request.UserId, request.TermId, cancellationToken);
        if (existing != null)
        {
            _glossaryMastered.Remove(existing);
            await _unitOfWork.SaveChangesAsync(cancellationToken);
            return Result<bool>.Success(false, "Term unmarked as mastered.");
        }

        var mastered = new GlossaryMastered
        {
            Id = Guid.NewGuid(),
            UserId = request.UserId,
            GlossaryTermId = request.TermId,
            MasteredAt = DateTime.UtcNow,
        };
        await _glossaryMastered.AddAsync(mastered, cancellationToken);
        await _unitOfWork.SaveChangesAsync(cancellationToken);
        return Result<bool>.Success(true, "Term marked as mastered.");
    }
}
