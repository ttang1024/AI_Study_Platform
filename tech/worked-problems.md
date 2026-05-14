# Worked Problems

## Overview

Worked problems are generated from document text or YouTube transcripts. Users can submit an answer, receive AI evaluation, and toggle mastery.

## Routes

`WorkedProblemsController` uses absolute routes:

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `GET` | `/api/documents/{documentId}/worked-problems` | List document worked problems |
| `POST` | `/api/documents/{documentId}/worked-problems/generate` | Generate document worked problems |
| `POST` | `/api/worked-problems/{id}/attempt` | Submit attempt |
| `GET` | `/api/worked-problems/{id}/attempts` | Attempt history |
| `GET` | `/api/worked-problems/mastered` | Mastered problem ids |
| `POST` | `/api/worked-problems/mastered/{problemId}` | Toggle mastered state |

YouTube saved-video routes:

- `GET /api/youtube/videos/{id}/worked-problems`
- `POST /api/youtube/videos/{id}/worked-problems/generate`

## Entities

`WorkedProblem`, `WorkedProblemAttempt`, and `WorkedProblemMastered` store generated steps, final answer, attempts/evaluations, and mastery.

## Implementation

### Generation

`GenerateWorkedProblemsCommandHandler` resolves content from either a document blob (via `IDocumentTextExtractor`) or a YouTube video's stored `Transcript`/`Summary`/`Title`, then calls `IAiService.GenerateWorkedProblemsAsync` and persists all returned problems in a single batch.

```csharp
// WorkedProblemCommands.cs — GenerateWorkedProblemsCommandHandler
string content = string.Empty;

if (request.DocumentId.HasValue)
{
    var doc = await _unitOfWork.Documents.GetByIdAsync(request.DocumentId.Value, ct);
    if (doc == null || doc.UserId != request.UserId)
        return Result<...>.Failure("Document not found.", "DOCUMENT_NOT_FOUND");
    content = await _textExtractor.ExtractTextAsync(doc.BlobUrl, doc.ContentType, ct);
}
else if (request.VideoId.HasValue)
{
    var video = await _unitOfWork.YouTubeVideos.GetByIdForUserAsync(request.VideoId.Value, request.UserId, ct);
    content = video.Transcript ?? video.Summary ?? video.Title;
}

var json  = await _aiService.GenerateWorkedProblemsAsync(content, request.Difficulty, request.Count, ct);
var items = JsonSerializer.Deserialize<List<AiProblemItem>>(json, ...) ?? [];

var problems = items.Select(i => new WorkedProblem
{
    WorkedProblemId = Guid.NewGuid(),
    UserId          = request.UserId,
    DocumentId      = request.DocumentId,
    YouTubeVideoId  = request.VideoId,
    ProblemText     = i.Problem,
    StepsJson       = JsonSerializer.Serialize(i.Steps ?? []),
    FinalAnswer     = i.Answer,
    Difficulty      = request.Difficulty,
    Topic           = i.Topic,
    CreatedAt       = DateTime.UtcNow,
}).ToList();

await _unitOfWork.WorkedProblems.AddRangeAsync(problems, ct);
await _unitOfWork.SaveChangesAsync(ct);
```

### Attempt Evaluation

`SubmitAttemptCommand` sends the problem, the AI-generated solution, and the user's answer to `IAiService.EvaluateProblemAttemptAsync`, then persists the evaluation result:

```csharp
var json = await _aiService.EvaluateProblemAttemptAsync(
    problem.ProblemText, problem.FinalAnswer, request.UserAnswer, ct);
// json: { "isCorrect": bool, "evaluation": "..." }
```

### Mastery Toggle

Works identically to glossary mastery — a `WorkedProblemMastered` row is inserted or deleted depending on whether one already exists.

## Frontend

`WorkedProblemsPanel.tsx` and `workedProblemsService.ts`.
