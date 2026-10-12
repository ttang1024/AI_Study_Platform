using MediatR;
using StudyPlatform.Application.Common;
using StudyPlatform.Application.Documents.DTOs;
using StudyPlatform.Application.Flashcards.DTOs;
using StudyPlatform.Application.Services;
using StudyPlatform.Domain.Interfaces;

namespace StudyPlatform.Application.Flashcards.Commands;

public record GetAllFlashcardsPagedQuery(Guid UserId, int Page, int PageSize) : IRequest<Result<PaginatedList<FlashcardDto>>>, IPagedRequest;

public record GetFlashcardCoverageQuery(Guid UserId) : IRequest<Result<FlashcardCoverageDto>>;

public record GetPendingFlashcardMaterialsQuery(Guid UserId) : IRequest<Result<IEnumerable<PendingMaterialDto>>>;

public class GetAllFlashcardsPagedQueryHandler : IRequestHandler<GetAllFlashcardsPagedQuery, Result<PaginatedList<FlashcardDto>>>
{
    private readonly IFlashcardRepository _flashcards;
    private readonly IFlashcardSrsDataRepository _flashcardSrs;
    public GetAllFlashcardsPagedQueryHandler(IFlashcardRepository flashcards, IFlashcardSrsDataRepository flashcardSrs) { _flashcards = flashcards;
    _flashcardSrs = flashcardSrs; }

    public async Task<Result<PaginatedList<FlashcardDto>>> Handle(GetAllFlashcardsPagedQuery request, CancellationToken cancellationToken)
    {
        var (flashcards, totalCount) = await _flashcards.GetPagedByUserIdAsync(request.UserId, request.Page, request.PageSize, cancellationToken);
        var srsData = await _flashcardSrs.GetByUserIdAsync(request.UserId, cancellationToken);
        var srsMap = srsData.ToDictionary(s => s.FlashcardId);
        var dtos = flashcards.Select(f => f.ToFlashcardDto(srsMap.GetValueOrDefault(f.FlashcardId)));
        return Result<PaginatedList<FlashcardDto>>.Success(new PaginatedList<FlashcardDto>(dtos, totalCount, request.Page, request.PageSize));
    }
}

public class GetFlashcardCoverageQueryHandler : IRequestHandler<GetFlashcardCoverageQuery, Result<FlashcardCoverageDto>>
{
    private readonly IFlashcardRepository _flashcards;
    public GetFlashcardCoverageQueryHandler(IFlashcardRepository flashcards) { _flashcards = flashcards; }

    public async Task<Result<FlashcardCoverageDto>> Handle(GetFlashcardCoverageQuery request, CancellationToken cancellationToken)
    {
        var (documentIds, videoIds) = await _flashcards.GetCoverageByUserIdAsync(request.UserId, cancellationToken);
        return Result<FlashcardCoverageDto>.Success(new FlashcardCoverageDto(documentIds, videoIds));
    }
}

public class GetPendingFlashcardMaterialsQueryHandler : IRequestHandler<GetPendingFlashcardMaterialsQuery, Result<IEnumerable<PendingMaterialDto>>>
{
    private readonly IFlashcardRepository _flashcards;
    private readonly IStudyMaterialLookup _materials;

    public GetPendingFlashcardMaterialsQueryHandler(IFlashcardRepository flashcards, IStudyMaterialLookup materials)
    {
        _flashcards = flashcards;
        _materials = materials;
    }

    public async Task<Result<IEnumerable<PendingMaterialDto>>> Handle(GetPendingFlashcardMaterialsQuery request, CancellationToken cancellationToken)
    {
        var (documentIdsWithCards, videoIdsWithCards) = await _flashcards.GetCoverageByUserIdAsync(request.UserId, cancellationToken);
        var pending = await _materials.ListUncoveredAsync(
            request.UserId, documentIdsWithCards, videoIdsWithCards, cancellationToken);
        return Result<IEnumerable<PendingMaterialDto>>.Success(pending);
    }
}
