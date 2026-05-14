# Documents

## Overview

Documents are course-scoped learning sources. A `Document` stores uploaded file metadata plus generated `Summary`, `MindMapText`, optional `Transcript`, and `OriginalUrl` for clipped articles.

## Main Routes

`DocumentsController` is mounted at `/api/courses/{courseId}/documents`.

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `GET` | `/` | List documents in a course |
| `GET` | `/{documentId}` | Load one document |
| `POST` | `/upload` | Upload a file |
| `DELETE` | `/{documentId}` | Delete a document |
| `PATCH` | `/{documentId}` | Update summary/mind map/name fields |
| `PATCH` | `/{documentId}/move` | Move to another course |
| `GET` | `/{documentId}/file` | Download/open original file |
| `POST` | `/{documentId}/summary/stream` | SSE summary generation |
| `POST` | `/{documentId}/mindmap/stream` | SSE mind map generation |
| `POST` | `/{documentId}/quiz/generate?difficulty=` | Generate quiz |
| `GET` | `/{documentId}/quiz?difficulty=` | List quiz questions |
| `POST` | `/{documentId}/quiz/submission` | Save quiz submission |
| `GET` | `/{documentId}/quiz/submission` | Get latest quiz submission |
| `POST` | `/{documentId}/flashcards/generate` | Generate flashcards |
| `GET` | `/{documentId}/flashcards` | List document flashcards |
| `GET` | `/{documentId}/glossary` | List glossary terms |
| `POST` | `/{documentId}/glossary/generate` | Generate glossary |
| `POST` | `/{documentId}/chat` | Non-streaming document chat |
| `POST` | `/{documentId}/chat/stream` | SSE document chat |
| `GET` | `/{documentId}/chat` | Chat history |
| `DELETE` | `/{documentId}/chat` | Clear chat history |
| `GET/POST/PUT/DELETE` | `/{documentId}/notes...` | Document-scoped notes |

Global document routes in `UserDocumentsController` use `/api/documents` for library listing, web clipping, and OCR. Import routes use `/api/documents/import`.

## Upload Handler

`UploadDocumentCommandHandler` enforces the per-user upload limit, streams the file to blob storage, and then persists the `Document` row. If blob storage fails the command returns a `STORAGE_ERROR` and no DB row is written.

```csharp
// UploadDocumentCommand.cs
public async Task<Result<DocumentDto>> Handle(UploadDocumentCommand request, CancellationToken ct)
{
    var course = await _unitOfWork.Courses.GetByIdAsync(request.CourseId, ct);
    if (course == null || course.UserId != request.UserId)
        return Result<DocumentDto>.Failure("Course not found.", "COURSE_NOT_FOUND");

    // Optional per-account upload cap
    if (_limits.DocumentUploadLimit >= 0)
    {
        var count = await _unitOfWork.Documents.CountByUserIdAsync(request.UserId, ct);
        if (count >= _limits.DocumentUploadLimit)
            return Result<DocumentDto>.Failure(
                $"Upload limit of {_limits.DocumentUploadLimit} documents per account reached.",
                "DOCUMENT_LIMIT_REACHED");
    }

    // Blob path: {userId}/{courseId}/{newGuid}_{originalFileName}
    var blobFileName = $"{request.UserId}/{request.CourseId}/{Guid.NewGuid()}_{request.FileName}";
    string blobUrl;
    try
    {
        blobUrl = await _blobStorageService.UploadAsync(
            request.FileStream, blobFileName, request.ContentType, ct);
    }
    catch (Exception ex)
    {
        _logger.LogError(ex, "Blob upload failed for course {CourseId}", request.CourseId);
        return Result<DocumentDto>.Failure("Storage unavailable.", "STORAGE_ERROR");
    }

    var document = new Document
    {
        DocumentId  = Guid.NewGuid(),
        CourseId    = request.CourseId,
        UserId      = request.UserId,
        FileName    = request.FileName,
        BlobUrl     = blobUrl,
        ContentType = request.ContentType,
        FileSize    = request.FileSize,
        CreatedAt   = DateTime.UtcNow,
        UpdatedAt   = DateTime.UtcNow
    };

    await _unitOfWork.Documents.AddAsync(document, ct);
    await _unitOfWork.SaveChangesAsync(ct);
    return Result<DocumentDto>.Success(MapToDto(document), "Document uploaded successfully.");
}
```

## SSE Summary Streaming

The summary stream endpoint in `DocumentsController` decides between file-based (Gemini multimodal) and text-based generation depending on whether extracted text is available:

```csharp
// DocumentsController.cs — StreamSummary
response.SetSseHeaders();
var text = await _documentContentService.GetTextContentAsync(document, ct);

var chunks = text != null
    ? _aiService.StreamSummaryAsync(text, ct)
    : _aiService.StreamSummaryAsync(bytes, document.ContentType, ct);  // file bytes → Gemini inline data

await foreach (var chunk in chunks)
    await response.WriteSseDataAsync(chunk, ct);
await response.WriteSseDoneAsync(ct);
```

## Content Extraction

`DocumentTextExtractorService` handles document text extraction. `DocumentContentService` centralizes access to stored document content for generation features.

## Frontend

Primary UI lives in `AISummarizerPage`, `LibraryPage`, `DocumentDetailsPage`, `ArticlePage`, `AnnotatedPdfViewer`, `DocumentViewer`, and related services in `web/src/services/documentService.ts`.
