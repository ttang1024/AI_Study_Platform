using MediatR;
using StudyPlatform.Application.Common;
using StudyPlatform.Application.Documents.DTOs;
using StudyPlatform.Application.Flashcards.DTOs;
using StudyPlatform.Application.Services;
using StudyPlatform.Domain.Interfaces;

namespace StudyPlatform.Application.Flashcards.Commands;

public record GetAllFlashcardsPagedQuery(Guid UserId, int Page, int PageSize) : IRequest<Result<PaginatedList<FlashcardDto>>>;

public record GetFlashcardCoverageQuery(Guid UserId) : IRequest<Result<FlashcardCoverageDto>>;

public record GetPendingFlashcardMaterialsQuery(Guid UserId) : IRequest<Result<IEnumerable<PendingMaterialDto>>>;

public class GetAllFlashcardsPagedQueryHandler : IRequestHandler<GetAllFlashcardsPagedQuery, Result<PaginatedList<FlashcardDto>>>
{
    private readonly IUnitOfWork _unitOfWork;
    public GetAllFlashcardsPagedQueryHandler(IUnitOfWork unitOfWork) { _unitOfWork = unitOfWork; }

    public async Task<Result<PaginatedList<FlashcardDto>>> Handle(GetAllFlashcardsPagedQuery request, CancellationToken cancellationToken)
    {
        var (flashcards, totalCount) = await _unitOfWork.Flashcards.GetPagedByUserIdAsync(request.UserId, request.Page, request.PageSize, cancellationToken);
        var srsData = await _unitOfWork.FlashcardSrs.GetByUserIdAsync(request.UserId, cancellationToken);
        var srsMap = srsData.ToDictionary(s => s.FlashcardId);
        var dtos = flashcards.Select(f => f.ToFlashcardDto(srsMap.GetValueOrDefault(f.FlashcardId)));
        return Result<PaginatedList<FlashcardDto>>.Success(new PaginatedList<FlashcardDto>(dtos, totalCount, request.Page, request.PageSize));
    }
}

public class GetFlashcardCoverageQueryHandler : IRequestHandler<GetFlashcardCoverageQuery, Result<FlashcardCoverageDto>>
{
    private readonly IUnitOfWork _unitOfWork;
    public GetFlashcardCoverageQueryHandler(IUnitOfWork unitOfWork) { _unitOfWork = unitOfWork; }

    public async Task<Result<FlashcardCoverageDto>> Handle(GetFlashcardCoverageQuery request, CancellationToken cancellationToken)
    {
        var (documentIds, videoIds) = await _unitOfWork.Flashcards.GetCoverageByUserIdAsync(request.UserId, cancellationToken);
        return Result<FlashcardCoverageDto>.Success(new FlashcardCoverageDto(documentIds, videoIds));
    }
}

public class GetPendingFlashcardMaterialsQueryHandler : IRequestHandler<GetPendingFlashcardMaterialsQuery, Result<IEnumerable<PendingMaterialDto>>>
{
    private readonly IUnitOfWork _unitOfWork;
    private readonly IStudyMaterialLookup _materials;

    public GetPendingFlashcardMaterialsQueryHandler(IUnitOfWork unitOfWork, IStudyMaterialLookup materials)
    {
        _unitOfWork = unitOfWork;
        _materials = materials;
    }

    public async Task<Result<IEnumerable<PendingMaterialDto>>> Handle(GetPendingFlashcardMaterialsQuery request, CancellationToken cancellationToken)
    {
        var (documentIdsWithCards, videoIdsWithCards) = await _unitOfWork.Flashcards.GetCoverageByUserIdAsync(request.UserId, cancellationToken);
        var pending = await _materials.ListUncoveredAsync(
            request.UserId, documentIdsWithCards, videoIdsWithCards, cancellationToken);
        return Result<IEnumerable<PendingMaterialDto>>.Success(pending);
    }
}
