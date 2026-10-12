using MediatR;
using StudyPlatform.Application.Common;
using StudyPlatform.Application.Services;
using StudyPlatform.Domain.Entities;
using StudyPlatform.Domain.Interfaces;

namespace StudyPlatform.Application.Annotations;

// ── DTOs ────────────────────────────────────────────────────────────────────

public record DocumentAnnotationDto(
    Guid DocumentAnnotationId,
    Guid DocumentId,
    Guid UserId,
    string HighlightedText,
    string? Note,
    string Color,
    int PageNumber,
    string RectJson,
    DateTime CreatedAt,
    DateTime UpdatedAt);

// ── Queries ─────────────────────────────────────────────────────────────────

public record GetAnnotationsByDocumentQuery(Guid UserId, Guid DocumentId) : IRequest<Result<IEnumerable<DocumentAnnotationDto>>>;

public class GetAnnotationsByDocumentQueryHandler : IRequestHandler<GetAnnotationsByDocumentQuery, Result<IEnumerable<DocumentAnnotationDto>>>
{
    private readonly IDocumentAnnotationRepository _documentAnnotations;
    public GetAnnotationsByDocumentQueryHandler(IDocumentAnnotationRepository documentAnnotations) { _documentAnnotations = documentAnnotations; }

    public async Task<Result<IEnumerable<DocumentAnnotationDto>>> Handle(GetAnnotationsByDocumentQuery request, CancellationToken cancellationToken)
    {
        var annotations = await _documentAnnotations.GetByDocumentAsync(request.DocumentId, request.UserId, cancellationToken);
        return Result<IEnumerable<DocumentAnnotationDto>>.Success(annotations.Select(ToDto));
    }

    internal static DocumentAnnotationDto ToDto(DocumentAnnotation a) =>
        new(a.DocumentAnnotationId, a.DocumentId, a.UserId, a.HighlightedText, a.Note, a.Color, a.PageNumber, a.RectJson, a.CreatedAt, a.UpdatedAt);
}

// ── Commands ─────────────────────────────────────────────────────────────────

public record CreateAnnotationCommand(
    Guid UserId,
    Guid DocumentId,
    string HighlightedText,
    string? Note,
    string Color,
    int PageNumber,
    string RectJson) : IRequest<Result<DocumentAnnotationDto>>;

public class CreateAnnotationCommandHandler : IRequestHandler<CreateAnnotationCommand, Result<DocumentAnnotationDto>>
{
    private readonly IUnitOfWork _unitOfWork;
    private readonly IDocumentRepository _documents;
    private readonly IDocumentAnnotationRepository _documentAnnotations;
    public CreateAnnotationCommandHandler(IUnitOfWork unitOfWork, IDocumentRepository documents, IDocumentAnnotationRepository documentAnnotations) { _unitOfWork = unitOfWork;
    _documents = documents;
    _documentAnnotations = documentAnnotations; }

    public async Task<Result<DocumentAnnotationDto>> Handle(CreateAnnotationCommand request, CancellationToken cancellationToken)
    {
        var doc = await _documents.GetOwnedAsync(request.DocumentId, request.UserId, cancellationToken);
        if (doc == null)
            return Result<DocumentAnnotationDto>.Failure("Document not found.", "DOCUMENT_NOT_FOUND");

        var annotation = new DocumentAnnotation
        {
            DocumentAnnotationId = Guid.NewGuid(),
            UserId = request.UserId,
            DocumentId = request.DocumentId,
            HighlightedText = request.HighlightedText,
            Note = request.Note,
            Color = string.IsNullOrWhiteSpace(request.Color) ? "#FFFF00" : request.Color,
            PageNumber = request.PageNumber,
            RectJson = request.RectJson,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        await _documentAnnotations.AddAsync(annotation, cancellationToken);
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        return Result<DocumentAnnotationDto>.Success(GetAnnotationsByDocumentQueryHandler.ToDto(annotation), "Annotation created.");
    }
}

public record UpdateAnnotationCommand(Guid UserId, Guid AnnotationId, string? Note, string Color) : IRequest<Result<DocumentAnnotationDto>>;

public class UpdateAnnotationCommandHandler : IRequestHandler<UpdateAnnotationCommand, Result<DocumentAnnotationDto>>
{
    private readonly IUnitOfWork _unitOfWork;
    private readonly IDocumentAnnotationRepository _documentAnnotations;
    public UpdateAnnotationCommandHandler(IUnitOfWork unitOfWork, IDocumentAnnotationRepository documentAnnotations) { _unitOfWork = unitOfWork;
    _documentAnnotations = documentAnnotations; }

    public async Task<Result<DocumentAnnotationDto>> Handle(UpdateAnnotationCommand request, CancellationToken cancellationToken)
    {
        var annotation = await _documentAnnotations.GetOwnedAsync(request.AnnotationId, request.UserId, cancellationToken);
        if (annotation == null)
            return Result<DocumentAnnotationDto>.Failure("Annotation not found.", "ANNOTATION_NOT_FOUND");

        annotation.Note = request.Note;
        annotation.Color = string.IsNullOrWhiteSpace(request.Color) ? annotation.Color : request.Color;
        annotation.UpdatedAt = DateTime.UtcNow;

        _documentAnnotations.Update(annotation);
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        return Result<DocumentAnnotationDto>.Success(GetAnnotationsByDocumentQueryHandler.ToDto(annotation), "Annotation updated.");
    }
}

public record DeleteAnnotationCommand(Guid UserId, Guid AnnotationId) : IRequest<Result<bool>>;

public class DeleteAnnotationCommandHandler : IRequestHandler<DeleteAnnotationCommand, Result<bool>>
{
    private readonly IUnitOfWork _unitOfWork;
    private readonly IDocumentAnnotationRepository _documentAnnotations;
    public DeleteAnnotationCommandHandler(IUnitOfWork unitOfWork, IDocumentAnnotationRepository documentAnnotations) { _unitOfWork = unitOfWork;
    _documentAnnotations = documentAnnotations; }

    public async Task<Result<bool>> Handle(DeleteAnnotationCommand request, CancellationToken cancellationToken)
    {
        var annotation = await _documentAnnotations.GetOwnedAsync(request.AnnotationId, request.UserId, cancellationToken);
        if (annotation == null)
            return Result<bool>.Failure("Annotation not found.", "ANNOTATION_NOT_FOUND");

        _documentAnnotations.Remove(annotation);
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        return Result<bool>.Success(true, "Annotation deleted.");
    }
}

public record CreateFlashcardFromAnnotationCommand(Guid UserId, Guid AnnotationId) : IRequest<Result<bool>>;

public class CreateFlashcardFromAnnotationCommandHandler : IRequestHandler<CreateFlashcardFromAnnotationCommand, Result<bool>>
{
    private readonly IUnitOfWork _unitOfWork;
    private readonly IFlashcardRepository _flashcards;
    private readonly IDocumentAnnotationRepository _documentAnnotations;
    private readonly IAiService _aiService;
    public CreateFlashcardFromAnnotationCommandHandler(IUnitOfWork unitOfWork, IFlashcardRepository flashcards, IDocumentAnnotationRepository documentAnnotations, IAiService aiService)
    {
        _unitOfWork = unitOfWork;
        _flashcards = flashcards;
        _documentAnnotations = documentAnnotations;
        _aiService = aiService;
    }

    public async Task<Result<bool>> Handle(CreateFlashcardFromAnnotationCommand request, CancellationToken cancellationToken)
    {
        var annotation = await _documentAnnotations.GetOwnedAsync(request.AnnotationId, request.UserId, cancellationToken);
        if (annotation == null)
            return Result<bool>.Failure("Annotation not found.", "ANNOTATION_NOT_FOUND");

        var back = await _aiService.GenerateFlashcardBackAsync(annotation.HighlightedText, cancellationToken);

        var flashcard = new Flashcard
        {
            FlashcardId = Guid.NewGuid(),
            DocumentId = annotation.DocumentId,
            SourceType = "document",
            UserId = request.UserId,
            Front = annotation.HighlightedText,
            Back = back.Trim(),
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        await _flashcards.AddAsync(flashcard, cancellationToken);
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        return Result<bool>.Success(true, "Flashcard created from annotation.");
    }
}
