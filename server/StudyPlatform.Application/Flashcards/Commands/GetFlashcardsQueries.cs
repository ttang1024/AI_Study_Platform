using MediatR;
using StudyPlatform.Application.Common;
using StudyPlatform.Application.Documents.DTOs;
using StudyPlatform.Application.Flashcards.DTOs;
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
    public GetPendingFlashcardMaterialsQueryHandler(IUnitOfWork unitOfWork) { _unitOfWork = unitOfWork; }

    public async Task<Result<IEnumerable<PendingMaterialDto>>> Handle(GetPendingFlashcardMaterialsQuery request, CancellationToken cancellationToken)
    {
        var (documentIdsWithCards, videoIdsWithCards) = await _unitOfWork.Flashcards.GetCoverageByUserIdAsync(request.UserId, cancellationToken);
        var documentIdSet = documentIdsWithCards.ToHashSet();
        var videoIdSet = videoIdsWithCards.ToHashSet();
        var courseMap = (await _unitOfWork.Courses.FindAsync(c => c.UserId == request.UserId, cancellationToken))
            .ToDictionary(c => c.CourseId);

        var documents = (await _unitOfWork.Documents.FindAsync(
                d => d.UserId == request.UserId && !documentIdSet.Contains(d.DocumentId),
                cancellationToken))
            .Select(d =>
            {
                courseMap.TryGetValue(d.CourseId, out var course);
                return new PendingMaterialDto(
                    "document",
                    d.DocumentId,
                    d.CourseId,
                    course?.CourseName ?? string.Empty,
                    course?.CourseColor ?? "#a1a1aa",
                    d.FileName,
                    d.ContentType,
                    d.BlobUrl,
                    d.OriginalUrl,
                    null,
                    null,
                    null,
                    d.CreatedAt);
            });

        var videos = (await _unitOfWork.Videos.FindAsync(
                v => v.UserId == request.UserId && !videoIdSet.Contains(v.VideoId),
                cancellationToken))
            .Select(v =>
            {
                courseMap.TryGetValue(v.CourseId, out var course);
                return new PendingMaterialDto(
                    "video",
                    v.VideoId,
                    v.CourseId,
                    course?.CourseName ?? string.Empty,
                    course?.CourseColor ?? "#a1a1aa",
                    v.Title,
                    null,
                    null,
                    null,
                    v.ExternalVideoId,
                    v.VideoUrl,
                    v.ThumbnailUrl,
                    v.CreatedAt,
                    v.SourceType);
            });

        return Result<IEnumerable<PendingMaterialDto>>.Success(
            documents.Concat(videos).OrderByDescending(m => m.CreatedAt));
    }
}
