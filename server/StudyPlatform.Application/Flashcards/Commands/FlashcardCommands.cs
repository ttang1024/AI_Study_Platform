using MediatR;
using StudyPlatform.Application.Common;
using StudyPlatform.Application.Documents.DTOs;
using StudyPlatform.Application.Flashcards.DTOs;
using StudyPlatform.Application.Services;
using StudyPlatform.Domain.Entities;
using StudyPlatform.Domain.Interfaces;

namespace StudyPlatform.Application.Flashcards.Commands;

public record CreateFlashcardCommand(
    Guid UserId,
    string Front,
    string Back,
    Guid? DocumentId = null,
    Guid? YouTubeVideoId = null,
    string CardType = "basic") : IRequest<Result<FlashcardDto>>;

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
            CardType = request.CardType,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        await _unitOfWork.Flashcards.AddAsync(flashcard, cancellationToken);
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        return Result<FlashcardDto>.Success(ToDto(flashcard), "Flashcard created successfully.");
    }

    internal static FlashcardDto ToDto(Flashcard f, FlashcardSrsData? srs = null) =>
        new(f.FlashcardId, f.DocumentId, f.YouTubeVideoId, f.SourceType, f.UserId, f.Front, f.Back, f.CreatedAt, f.UpdatedAt,
            Title: f.Document?.FileName ?? f.YouTubeVideo?.Title,
            Document: f.Document?.FileName,
            Video: f.YouTubeVideo?.Title,
            Srs: srs == null ? null : ToSrsDto(srs),
            CardType: f.CardType,
            Difficulty: f.Difficulty,
            Chapter: f.Chapter,
            Tags: f.Tags);

    internal static FlashcardSrsDto ToSrsDto(FlashcardSrsData srs) =>
        new(srs.FlashcardId, srs.State, srs.Stability, srs.Difficulty, srs.Reps, srs.Lapses,
            srs.Due, srs.LastReview,
            FsrsService.ComputeRetrievability(srs.Stability, srs.LastReview));
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
        var srsData = await _unitOfWork.FlashcardSrs.GetByUserIdAsync(request.UserId, cancellationToken);
        var srsMap = srsData.ToDictionary(s => s.FlashcardId);
        var dtos = flashcards.Select(f => CreateFlashcardCommandHandler.ToDto(f, srsMap.GetValueOrDefault(f.FlashcardId)));
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
        var srsData = await _unitOfWork.FlashcardSrs.GetByUserIdAsync(request.UserId, cancellationToken);
        var srsMap = srsData.ToDictionary(s => s.FlashcardId);
        return Result<IEnumerable<FlashcardDto>>.Success(flashcards.Select(f => CreateFlashcardCommandHandler.ToDto(f, srsMap.GetValueOrDefault(f.FlashcardId))));
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

// ─── FSRS Review ─────────────────────────────────────────────────────────────

public record ReviewFlashcardCommand(Guid FlashcardId, Guid UserId, int Rating) : IRequest<Result<ReviewFlashcardResponse>>;

public class ReviewFlashcardCommandHandler : IRequestHandler<ReviewFlashcardCommand, Result<ReviewFlashcardResponse>>
{
    private readonly IUnitOfWork _unitOfWork;
    public ReviewFlashcardCommandHandler(IUnitOfWork unitOfWork) { _unitOfWork = unitOfWork; }

    public async Task<Result<ReviewFlashcardResponse>> Handle(ReviewFlashcardCommand request, CancellationToken cancellationToken)
    {
        if (request.Rating is < 1 or > 4)
            return Result<ReviewFlashcardResponse>.Failure("Rating must be 1–4.", "INVALID_RATING");

        var flashcard = await _unitOfWork.Flashcards.GetByIdAsync(request.FlashcardId, cancellationToken);
        if (flashcard == null || flashcard.UserId != request.UserId)
            return Result<ReviewFlashcardResponse>.Failure("Flashcard not found.", "FLASHCARD_NOT_FOUND");

        var srs = await _unitOfWork.FlashcardSrs.GetByUserAndFlashcardAsync(
            request.UserId, request.FlashcardId, cancellationToken)
            ?? new FlashcardSrsData
            {
                Id = Guid.NewGuid(),
                UserId = request.UserId,
                FlashcardId = request.FlashcardId,
                Due = DateTime.UtcNow,
            };

        var result = FsrsService.Review(srs, request.Rating, DateTime.UtcNow);

        srs.State = result.State;
        srs.Stability = result.Stability;
        srs.Difficulty = result.Difficulty;
        srs.Reps = result.Reps;
        srs.Lapses = result.Lapses;
        srs.ScheduledDays = result.ScheduledDays;
        srs.ElapsedDays = result.ElapsedDays;
        srs.LastReview = result.LastReview;
        srs.Due = result.Due;

        if (srs.Reps == 1)
            await _unitOfWork.FlashcardSrs.AddAsync(srs, cancellationToken);

        await _unitOfWork.SaveChangesAsync(cancellationToken);

        var srsDto = CreateFlashcardCommandHandler.ToSrsDto(srs);
        return Result<ReviewFlashcardResponse>.Success(
            new ReviewFlashcardResponse(result.ScheduledDays, result.Retrievability, srsDto));
    }
}

// ─── SRS State Query ─────────────────────────────────────────────────────────

public record GetFlashcardSrsQuery(Guid UserId) : IRequest<Result<IEnumerable<FlashcardSrsDto>>>;

public class GetFlashcardSrsQueryHandler : IRequestHandler<GetFlashcardSrsQuery, Result<IEnumerable<FlashcardSrsDto>>>
{
    private readonly IUnitOfWork _unitOfWork;
    public GetFlashcardSrsQueryHandler(IUnitOfWork unitOfWork) { _unitOfWork = unitOfWork; }

    public async Task<Result<IEnumerable<FlashcardSrsDto>>> Handle(GetFlashcardSrsQuery request, CancellationToken cancellationToken)
    {
        var all = await _unitOfWork.FlashcardSrs.GetByUserIdAsync(request.UserId, cancellationToken);
        var dtos = all.Select(CreateFlashcardCommandHandler.ToSrsDto);
        return Result<IEnumerable<FlashcardSrsDto>>.Success(dtos);
    }
}

// ─── Classify Flashcard ───────────────────────────────────────────────────────

public record ClassifyFlashcardCommand(
    Guid FlashcardId,
    Guid UserId,
    string? Front,
    string? Back,
    string? Difficulty,
    string? Chapter,
    IEnumerable<string>? Tags) : IRequest<Result<FlashcardDto>>;

public class ClassifyFlashcardCommandHandler : IRequestHandler<ClassifyFlashcardCommand, Result<FlashcardDto>>
{
    private readonly IUnitOfWork _unitOfWork;
    public ClassifyFlashcardCommandHandler(IUnitOfWork unitOfWork) { _unitOfWork = unitOfWork; }

    public async Task<Result<FlashcardDto>> Handle(ClassifyFlashcardCommand request, CancellationToken cancellationToken)
    {
        var flashcard = await _unitOfWork.Flashcards.GetByIdAsync(request.FlashcardId, cancellationToken);
        if (flashcard == null || flashcard.UserId != request.UserId)
            return Result<FlashcardDto>.Failure("Flashcard not found.", "FLASHCARD_NOT_FOUND");

        if (!string.IsNullOrWhiteSpace(request.Front))
            flashcard.Front = request.Front.Trim();

        if (!string.IsNullOrWhiteSpace(request.Back))
            flashcard.Back = request.Back.Trim();

        if (request.Difficulty is not null)
            flashcard.Difficulty = request.Difficulty;

        if (request.Chapter is not null)
            flashcard.Chapter = string.IsNullOrWhiteSpace(request.Chapter) ? null : request.Chapter.Trim();

        if (request.Tags is not null)
            flashcard.Tags = request.Tags
                .Select(t => t.Trim().ToLowerInvariant())
                .Where(t => t.Length > 0)
                .Distinct()
                .ToList();

        flashcard.UpdatedAt = DateTime.UtcNow;
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        return Result<FlashcardDto>.Success(CreateFlashcardCommandHandler.ToDto(flashcard));
    }
}

