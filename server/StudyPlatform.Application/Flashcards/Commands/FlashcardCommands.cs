using MediatR;
using StudyPlatform.Application.Common;
using StudyPlatform.Application.Documents.DTOs;
using StudyPlatform.Application.Flashcards.DTOs;
using StudyPlatform.Domain.Entities;
using StudyPlatform.Domain.Interfaces;

namespace StudyPlatform.Application.Flashcards.Commands;

public record CreateFlashcardCommand(
    Guid UserId,
    string Front,
    string Back,
    Guid? DocumentId = null,
    Guid? YouTubeVideoId = null) : IRequest<Result<FlashcardDto>>;

public class CreateFlashcardCommandHandler : IRequestHandler<CreateFlashcardCommand, Result<FlashcardDto>>
{
    private readonly IUnitOfWork _unitOfWork;
    public CreateFlashcardCommandHandler(IUnitOfWork unitOfWork) { _unitOfWork = unitOfWork; }

    public async Task<Result<FlashcardDto>> Handle(CreateFlashcardCommand request, CancellationToken cancellationToken)
    {
        if (request.DocumentId.HasValue)
        {
            var doc = await _unitOfWork.Documents.GetByIdAsync(request.DocumentId.Value, cancellationToken);
            if (doc == null || doc.UserId != request.UserId)
                return Result<FlashcardDto>.Failure("Document not found.", "DOCUMENT_NOT_FOUND");
        }

        var flashcard = new Flashcard
        {
            FlashcardId = Guid.NewGuid(),
            DocumentId = request.DocumentId,
            YouTubeVideoId = request.YouTubeVideoId,
            SourceType = request.YouTubeVideoId.HasValue ? "video" : "document",
            UserId = request.UserId,
            Front = request.Front,
            Back = request.Back,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        await _unitOfWork.Flashcards.AddAsync(flashcard, cancellationToken);
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        return Result<FlashcardDto>.Success(ToDto(flashcard), "Flashcard created successfully.");
    }

    internal static FlashcardDto ToDto(Flashcard f) =>
        new(f.FlashcardId, f.DocumentId, f.YouTubeVideoId, f.SourceType, f.UserId, f.Front, f.Back, f.CreatedAt, f.UpdatedAt,
            Title: f.Document?.FileName ?? f.YouTubeVideo?.Title,
            Document: f.Document?.FileName,
            Video: f.YouTubeVideo?.Title);
}

public record GetAllFlashcardsQuery(Guid UserId) : IRequest<Result<IEnumerable<FlashcardDto>>>;

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
        var dtos = flashcards.Select(CreateFlashcardCommandHandler.ToDto);
        return Result<PaginatedList<FlashcardDto>>.Success(new PaginatedList<FlashcardDto>(dtos, totalCount, request.Page, request.PageSize));
    }
}

public class GetAllFlashcardsQueryHandler : IRequestHandler<GetAllFlashcardsQuery, Result<IEnumerable<FlashcardDto>>>
{
    private readonly IUnitOfWork _unitOfWork;
    public GetAllFlashcardsQueryHandler(IUnitOfWork unitOfWork) { _unitOfWork = unitOfWork; }

    public async Task<Result<IEnumerable<FlashcardDto>>> Handle(GetAllFlashcardsQuery request, CancellationToken cancellationToken)
    {
        var flashcards = await _unitOfWork.Flashcards.GetByUserIdAsync(request.UserId, cancellationToken);
        return Result<IEnumerable<FlashcardDto>>.Success(flashcards.Select(CreateFlashcardCommandHandler.ToDto));
    }
}

public class GetFlashcardCoverageQueryHandler : IRequestHandler<GetFlashcardCoverageQuery, Result<FlashcardCoverageDto>>
{
    private readonly IUnitOfWork _unitOfWork;
    public GetFlashcardCoverageQueryHandler(IUnitOfWork unitOfWork) { _unitOfWork = unitOfWork; }

    public async Task<Result<FlashcardCoverageDto>> Handle(GetFlashcardCoverageQuery request, CancellationToken cancellationToken)
    {
        var (documentIds, youTubeVideoIds) = await _unitOfWork.Flashcards.GetCoverageByUserIdAsync(request.UserId, cancellationToken);
        return Result<FlashcardCoverageDto>.Success(new FlashcardCoverageDto(documentIds, youTubeVideoIds));
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

        var videos = (await _unitOfWork.YouTubeVideos.FindAsync(
                v => v.UserId == request.UserId && !videoIdSet.Contains(v.YouTubeVideoId),
                cancellationToken))
            .Select(v =>
            {
                courseMap.TryGetValue(v.CourseId, out var course);
                return new PendingMaterialDto(
                    "video",
                    v.YouTubeVideoId,
                    v.CourseId,
                    course?.CourseName ?? string.Empty,
                    course?.CourseColor ?? "#a1a1aa",
                    v.Title,
                    null,
                    null,
                    null,
                    v.VideoId,
                    v.VideoUrl,
                    v.ThumbnailUrl,
                    v.CreatedAt);
            });

        return Result<IEnumerable<PendingMaterialDto>>.Success(
            documents.Concat(videos).OrderByDescending(m => m.CreatedAt));
    }
}

public record DeleteFlashcardCommand(Guid FlashcardId, Guid UserId) : IRequest<Result>;

public class DeleteFlashcardCommandHandler : IRequestHandler<DeleteFlashcardCommand, Result>
{
    private readonly IUnitOfWork _unitOfWork;
    public DeleteFlashcardCommandHandler(IUnitOfWork unitOfWork) { _unitOfWork = unitOfWork; }

    public async Task<Result> Handle(DeleteFlashcardCommand request, CancellationToken cancellationToken)
    {
        var flashcard = await _unitOfWork.Flashcards.GetByIdAsync(request.FlashcardId, cancellationToken);
        if (flashcard == null || flashcard.UserId != request.UserId)
            return Result.Failure("Flashcard not found.", "FLASHCARD_NOT_FOUND");

        _unitOfWork.Flashcards.Remove(flashcard);
        await _unitOfWork.SaveChangesAsync(cancellationToken);
        return Result.Success("Flashcard deleted successfully.");
    }
}

public record BulkDeleteFlashcardsCommand(IEnumerable<Guid> FlashcardIds, Guid UserId) : IRequest<Result>;

public class BulkDeleteFlashcardsCommandHandler : IRequestHandler<BulkDeleteFlashcardsCommand, Result>
{
    private readonly IUnitOfWork _unitOfWork;
    public BulkDeleteFlashcardsCommandHandler(IUnitOfWork unitOfWork) { _unitOfWork = unitOfWork; }

    public async Task<Result> Handle(BulkDeleteFlashcardsCommand request, CancellationToken cancellationToken)
    {
        await _unitOfWork.Flashcards.DeleteByIdsAsync(request.FlashcardIds, request.UserId, cancellationToken);
        await _unitOfWork.SaveChangesAsync(cancellationToken);
        return Result.Success("Flashcards deleted successfully.");
    }
}

