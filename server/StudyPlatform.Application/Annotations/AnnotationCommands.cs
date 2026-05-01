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
    private readonly IUnitOfWork _unitOfWork;
    public GetAnnotationsByDocumentQueryHandler(IUnitOfWork unitOfWork) { _unitOfWork = unitOfWork; }

    public async Task<Result<IEnumerable<DocumentAnnotationDto>>> Handle(GetAnnotationsByDocumentQuery request, CancellationToken cancellationToken)
    {
        var annotations = await _unitOfWork.DocumentAnnotations.GetByDocumentAsync(request.DocumentId, request.UserId, cancellationToken);
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
    public CreateAnnotationCommandHandler(IUnitOfWork unitOfWork) { _unitOfWork = unitOfWork; }

    public async Task<Result<DocumentAnnotationDto>> Handle(CreateAnnotationCommand request, CancellationToken cancellationToken)
    {
        var doc = await _unitOfWork.Documents.GetByIdAsync(request.DocumentId, cancellationToken);
        if (doc == null || doc.UserId != request.UserId)
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

        await _unitOfWork.DocumentAnnotations.AddAsync(annotation, cancellationToken);
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        return Result<DocumentAnnotationDto>.Success(GetAnnotationsByDocumentQueryHandler.ToDto(annotation), "Annotation created.");
    }
}

public record UpdateAnnotationCommand(Guid UserId, Guid AnnotationId, string? Note, string Color) : IRequest<Result<DocumentAnnotationDto>>;

public class UpdateAnnotationCommandHandler : IRequestHandler<UpdateAnnotationCommand, Result<DocumentAnnotationDto>>
{
    private readonly IUnitOfWork _unitOfWork;
    public UpdateAnnotationCommandHandler(IUnitOfWork unitOfWork) { _unitOfWork = unitOfWork; }

    public async Task<Result<DocumentAnnotationDto>> Handle(UpdateAnnotationCommand request, CancellationToken cancellationToken)
    {
        var annotation = await _unitOfWork.DocumentAnnotations.GetByIdAsync(request.AnnotationId, cancellationToken);
        if (annotation == null || annotation.UserId != request.UserId)
            return Result<DocumentAnnotationDto>.Failure("Annotation not found.", "ANNOTATION_NOT_FOUND");

        annotation.Note = request.Note;
        annotation.Color = string.IsNullOrWhiteSpace(request.Color) ? annotation.Color : request.Color;
        annotation.UpdatedAt = DateTime.UtcNow;

        _unitOfWork.DocumentAnnotations.Update(annotation);
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        return Result<DocumentAnnotationDto>.Success(GetAnnotationsByDocumentQueryHandler.ToDto(annotation), "Annotation updated.");
    }
}

public record DeleteAnnotationCommand(Guid UserId, Guid AnnotationId) : IRequest<Result<bool>>;

public class DeleteAnnotationCommandHandler : IRequestHandler<DeleteAnnotationCommand, Result<bool>>
{
    private readonly IUnitOfWork _unitOfWork;
    public DeleteAnnotationCommandHandler(IUnitOfWork unitOfWork) { _unitOfWork = unitOfWork; }

    public async Task<Result<bool>> Handle(DeleteAnnotationCommand request, CancellationToken cancellationToken)
    {
        var annotation = await _unitOfWork.DocumentAnnotations.GetByIdAsync(request.AnnotationId, cancellationToken);
        if (annotation == null || annotation.UserId != request.UserId)
            return Result<bool>.Failure("Annotation not found.", "ANNOTATION_NOT_FOUND");

        _unitOfWork.DocumentAnnotations.Remove(annotation);
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        return Result<bool>.Success(true, "Annotation deleted.");
    }
}

public record CreateFlashcardFromAnnotationCommand(Guid UserId, Guid AnnotationId) : IRequest<Result<bool>>;

public class CreateFlashcardFromAnnotationCommandHandler : IRequestHandler<CreateFlashcardFromAnnotationCommand, Result<bool>>
{
    private readonly IUnitOfWork _unitOfWork;
    private readonly IAiService _aiService;
    public CreateFlashcardFromAnnotationCommandHandler(IUnitOfWork unitOfWork, IAiService aiService)
    {
        _unitOfWork = unitOfWork;
        _aiService = aiService;
    }

    public async Task<Result<bool>> Handle(CreateFlashcardFromAnnotationCommand request, CancellationToken cancellationToken)
    {
        var annotation = await _unitOfWork.DocumentAnnotations.GetByIdAsync(request.AnnotationId, cancellationToken);
        if (annotation == null || annotation.UserId != request.UserId)
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

        await _unitOfWork.Flashcards.AddAsync(flashcard, cancellationToken);
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        return Result<bool>.Success(true, "Flashcard created from annotation.");
    }
}
