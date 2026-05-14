# Glossary

## Overview

Glossary terms can be generated from documents and saved YouTube videos. Users can also manage glossary terms globally and mark terms as mastered.

## Routes

Global glossary routes are in `GlossaryController` at `/api/glossary`.

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `GET` | `/api/glossary` | List glossary terms |
| `GET` | `/api/glossary/mastered` | List mastered term ids |
| `POST` | `/api/glossary/mastered/{termId}` | Toggle mastered state |
| `PUT` | `/api/glossary/terms/{termId}` | Edit a term |
| `DELETE` | `/api/glossary/terms/{termId}` | Delete a term |

Source generation routes:

- `GET/POST /api/courses/{courseId}/documents/{documentId}/glossary...`
- `GET/POST /api/youtube/videos/{id}/glossary...`

## Mastery Toggle

`ToggleGlossaryMasteredCommand` is an idempotent toggle: if a `GlossaryMastered` row already exists it is deleted (unmaster); otherwise a new one is inserted (master). The response payload is the resulting boolean state.

```csharp
// GlossaryMasteredCommands.cs — ToggleGlossaryMasteredCommandHandler
public async Task<Result<bool>> Handle(ToggleGlossaryMasteredCommand request, CancellationToken ct)
{
    var existing = await _unitOfWork.GlossaryMastered
        .GetByUserAndTermAsync(request.UserId, request.TermId, ct);

    if (existing != null)
    {
        _unitOfWork.GlossaryMastered.Remove(existing);
        await _unitOfWork.SaveChangesAsync(ct);
        return Result<bool>.Success(false, "Term unmarked as mastered.");
    }

    await _unitOfWork.GlossaryMastered.AddAsync(new GlossaryMastered
    {
        Id            = Guid.NewGuid(),
        UserId        = request.UserId,
        GlossaryTermId = request.TermId,
        MasteredAt    = DateTime.UtcNow,
    }, ct);

    await _unitOfWork.SaveChangesAsync(ct);
    return Result<bool>.Success(true, "Term marked as mastered.");
}
```

The same toggle pattern is used for worked-problem mastery (`ToggleWorkedProblemMasteredCommand`).

## Frontend

`GlossaryPage`, `GlossaryTermCard`, `GlossaryTooltip`, `GlossaryShareModal`, and `glossaryService.ts`.
