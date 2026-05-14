# Annotations

## Routes

`AnnotationsController` uses absolute routes:

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `POST` | `/api/documents/{documentId}/annotations` | Create annotation |
| `GET` | `/api/documents/{documentId}/annotations` | List document annotations |
| `PUT` | `/api/annotations/{id}` | Update annotation |
| `DELETE` | `/api/annotations/{id}` | Delete annotation |
| `POST` | `/api/annotations/{id}/create-flashcard` | Create flashcard from annotation |

## Implementation

All annotation logic lives in `server/StudyPlatform.Application/Annotations/AnnotationCommands.cs`.

### Create Annotation

Ownership of the parent document is verified before the annotation is persisted. The default highlight colour is `#FFFF00` when the caller sends an empty string.

```csharp
// AnnotationCommands.cs — CreateAnnotationCommandHandler
public async Task<Result<DocumentAnnotationDto>> Handle(CreateAnnotationCommand request, CancellationToken ct)
{
    var doc = await _unitOfWork.Documents.GetByIdAsync(request.DocumentId, ct);
    if (doc == null || doc.UserId != request.UserId)
        return Result<DocumentAnnotationDto>.Failure("Document not found.", "DOCUMENT_NOT_FOUND");

    var annotation = new DocumentAnnotation
    {
        DocumentAnnotationId = Guid.NewGuid(),
        UserId      = request.UserId,
        DocumentId  = request.DocumentId,
        HighlightedText = request.HighlightedText,
        Note        = request.Note,
        Color       = string.IsNullOrWhiteSpace(request.Color) ? "#FFFF00" : request.Color,
        PageNumber  = request.PageNumber,
        RectJson    = request.RectJson,
        CreatedAt   = DateTime.UtcNow,
        UpdatedAt   = DateTime.UtcNow
    };

    await _unitOfWork.DocumentAnnotations.AddAsync(annotation, ct);
    await _unitOfWork.SaveChangesAsync(ct);
    return Result<DocumentAnnotationDto>.Success(ToDto(annotation), "Annotation created.");
}
```

### Create Flashcard from Annotation

`CreateFlashcardFromAnnotationCommand` calls `IAiService.GenerateFlashcardBackAsync` with the highlighted text as the front, then creates and saves a `Flashcard` scoped to the same document:

```csharp
// AnnotationCommands.cs — CreateFlashcardFromAnnotationCommandHandler
var annotation = await _unitOfWork.DocumentAnnotations.GetByIdAsync(request.AnnotationId, ct);
if (annotation == null || annotation.UserId != request.UserId)
    return Result<bool>.Failure("Annotation not found.", "ANNOTATION_NOT_FOUND");

var back = await _aiService.GenerateFlashcardBackAsync(annotation.HighlightedText, ct);

var flashcard = new Flashcard
{
    FlashcardId = Guid.NewGuid(),
    DocumentId  = annotation.DocumentId,
    SourceType  = "document",
    UserId      = request.UserId,
    Front       = annotation.HighlightedText,
    Back        = back.Trim(),
    CreatedAt   = DateTime.UtcNow,
    UpdatedAt   = DateTime.UtcNow
};

await _unitOfWork.Flashcards.AddAsync(flashcard, ct);
await _unitOfWork.SaveChangesAsync(ct);
```

## Frontend

PDF annotation UI is in `AnnotatedPdfViewer`, `AnnotationToolbar`, `AnnotationsSidebar`, `TextSelectionToolbar`, and `annotationsService.ts`.
