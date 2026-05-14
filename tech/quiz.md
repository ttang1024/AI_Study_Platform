# Quiz And Question Bank

## Source Quizzes

Document quiz routes are under `/api/courses/{courseId}/documents/{documentId}`:

- `POST /quiz/generate?difficulty=easy|medium|hard`
- `GET /quiz?difficulty=...`
- `POST /quiz/submission`
- `GET /quiz/submission`

YouTube quiz routes are under `/api/youtube/videos/{id}`:

- `GET /quiz?difficulty=...`
- `POST /quiz/generate?difficulty=...`
- `POST /quiz/submit`
- `GET /quiz/submission`

`Quiz` supports `DocumentId?`, `YouTubeVideoId?`, `SourceType`, `Question`, `OptionsJson`, `CorrectAnswer`, `Explanation`, and `Difficulty`.

## Question Bank

`QuestionBankController` is mounted at `/api/question-bank`.

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `GET` | `/api/question-bank` | List/filter user questions |
| `PATCH` | `/api/question-bank/{quizId}` | Edit a question |
| `DELETE` | `/api/question-bank/{quizId}` | Delete a question |

### Frontend Pagination

The Question Bank list in `QuizManagementPage` paginates client-side at **10 items per page** (`BANK_PAGE_SIZE = 10`). `bankFiltered` (the full filtered set) is sliced before being passed to `QuestionBankTab` as `questions`. The full count is passed separately via `totalCount` so the "N questions" badge always reflects the total, not just the current page. Page resets to 1 whenever search, course, or difficulty filters change.

## Quiz Submission Handler

`SaveQuizSubmissionCommandHandler` upserts the user's latest answers, score, and total for a given document or video. Re-submitting overwrites the previous result.

```csharp
// SaveQuizSubmissionCommand.cs
public async Task<Result<QuizSubmissionDto>> Handle(
    SaveQuizSubmissionCommand request, CancellationToken cancellationToken)
{
    var document = await _unitOfWork.Documents.GetByIdAsync(request.DocumentId, cancellationToken);
    if (document == null || document.UserId != request.UserId)
        return Result<QuizSubmissionDto>.Failure("Document not found.", "DOCUMENT_NOT_FOUND");

    var existing = await _unitOfWork.QuizSubmissions
        .GetByDocumentAndUserAsync(request.DocumentId, request.UserId, cancellationToken);

    var answersJson = JsonSerializer.Serialize(request.Answers);

    if (existing != null)
    {
        // Overwrite previous submission
        existing.AnswersJson  = answersJson;
        existing.Score        = request.Score;
        existing.Total        = request.Total;
        existing.SubmittedAt  = DateTime.UtcNow;
        _unitOfWork.QuizSubmissions.Update(existing);
    }
    else
    {
        existing = new QuizSubmission
        {
            SubmissionId = Guid.NewGuid(),
            DocumentId   = request.DocumentId,
            SourceType   = "document",
            UserId       = request.UserId,
            AnswersJson  = answersJson,
            Score        = request.Score,
            Total        = request.Total,
            SubmittedAt  = DateTime.UtcNow,
        };
        await _unitOfWork.QuizSubmissions.AddAsync(existing, cancellationToken);
    }

    await _unitOfWork.SaveChangesAsync(cancellationToken);
    return Result<QuizSubmissionDto>.Success(/* dto */);
}
```

## Related Frontend

`QuizManagementPage`, `QuestionBankPage`, `DocumentQuiz`, `QuestionBankTab`, `FailedQuestionsTab`, `QuizModal`, `TimedExamModal`, and `questionBankService.ts`.
