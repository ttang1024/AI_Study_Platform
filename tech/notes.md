# Notes

## Routes

`NotesController` is mounted at `/api/notes`.

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `GET` | `/api/notes` | List notes |
| `POST` | `/api/notes` | Create note |
| `PUT` | `/api/notes/{noteId}` | Update note |
| `DELETE` | `/api/notes/{noteId}` | Delete note |
| `DELETE` | `/api/notes/bulk` | Bulk delete notes |

Document-scoped note helpers also exist under `/api/courses/{courseId}/documents/{documentId}/notes`.

## Implementation

### Create Note

Notes are optionally scoped to a document or YouTube video. `SourceType` is derived from whichever ID is provided.

```csharp
// NoteCommands.cs — CreateNoteCommandHandler
var note = new Note
{
    NoteId           = Guid.NewGuid(),
    UserId           = request.UserId,
    DocumentId       = request.DocumentId,
    YouTubeVideoId   = request.YouTubeVideoId,
    SourceType       = request.YouTubeVideoId.HasValue ? "video" : "document",
    Content          = request.Content,
    Title            = request.Title,
    CreatedAt        = DateTime.UtcNow,
    UpdatedAt        = DateTime.UtcNow
};
await _unitOfWork.Notes.AddAsync(note, cancellationToken);
await _unitOfWork.SaveChangesAsync(cancellationToken);
```

### Paginated List

`GetAllNotesPagedQuery` delegates paging to the repository and wraps the result in `PaginatedList<NoteDto>`, which carries `TotalCount` alongside the current page so the frontend can render pagination controls without a separate count query.

```csharp
// NoteCommands.cs — GetAllNotesPagedQueryHandler
var (notes, totalCount) = await _unitOfWork.Notes
    .GetPagedByUserIdAsync(request.UserId, request.Page, request.PageSize, cancellationToken);

var dtos = notes.Select(CreateNoteCommandHandler.ToDto);
return Result<PaginatedList<NoteDto>>.Success(
    new PaginatedList<NoteDto>(dtos, totalCount, request.Page, request.PageSize));
```

### Update Note

Only `Content` and `Title` are mutable. `UpdatedAt` is bumped on every save.

```csharp
// NoteCommands.cs — UpdateNoteCommandHandler
var note = await _unitOfWork.Notes
    .FirstOrDefaultAsync(n => n.NoteId == request.NoteId && n.UserId == request.UserId, ct);
if (note == null) return Result<NoteDto>.Failure("Note not found.", "NOTE_NOT_FOUND");

note.Content   = request.Content;
note.Title     = request.Title;
note.UpdatedAt = DateTime.UtcNow;
_unitOfWork.Notes.Update(note);
await _unitOfWork.SaveChangesAsync(ct);
```

## Frontend

`NotesPage`, `NotesList`, `RichTextEditor`, `VideoNoteEditor`, and `noteService.ts` implement note workflows.
