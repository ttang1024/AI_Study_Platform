# Flashcards

## Entity

`Flashcard` supports document and video sources:

- `DocumentId?`
- `YouTubeVideoId?`
- `SourceType`
- `Front`
- `Back`
- `CardType`: `basic`, `cloze`, or `chart`
- `Difficulty`: `easy`, `medium`, or `hard`
- `Chapter`
- `Tags`

FSRS review state is stored separately in `FlashcardSrsData`.

## Routes

`FlashcardsController` is mounted at `/api/flashcards`.

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `GET` | `/api/flashcards` | Paginated user flashcards |
| `GET` | `/api/flashcards/coverage` | Coverage summary |
| `GET` | `/api/flashcards/pending-materials` | Sources missing flashcards |
| `POST` | `/api/flashcards` | Create manual flashcard |
| `DELETE` | `/api/flashcards/{flashcardId}` | Delete one card |
| `DELETE` | `/api/flashcards/bulk` | Delete multiple cards |
| `POST` | `/api/flashcards/{flashcardId}/review` | Record FSRS review rating |
| `GET` | `/api/flashcards/srs` | Current SRS states |
| `PATCH` | `/api/flashcards/{flashcardId}/classify` | Update difficulty/classification |

Source-scoped generation routes live under document and YouTube controllers.

## FSRS Review Handler

`ReviewFlashcardCommandHandler` loads or bootstraps the `FlashcardSrsData` row for the card, delegates the math to `FsrsService.Review`, writes the updated state back, and returns the next scheduled interval.

```csharp
// FlashcardCommands.cs — ReviewFlashcardCommandHandler
public async Task<Result<ReviewFlashcardResponse>> Handle(
    ReviewFlashcardCommand request, CancellationToken cancellationToken)
{
    if (request.Rating is < 1 or > 4)
        return Result<ReviewFlashcardResponse>.Failure("Rating must be 1–4.", "INVALID_RATING");

    var flashcard = await _unitOfWork.Flashcards.GetByIdAsync(request.FlashcardId, cancellationToken);
    if (flashcard == null || flashcard.UserId != request.UserId)
        return Result<ReviewFlashcardResponse>.Failure("Flashcard not found.", "FLASHCARD_NOT_FOUND");

    // Bootstrap SRS state on first review
    var srs = await _unitOfWork.FlashcardSrs.GetByUserAndFlashcardAsync(
        request.UserId, request.FlashcardId, cancellationToken)
        ?? new FlashcardSrsData { Id = Guid.NewGuid(), UserId = request.UserId,
                                  FlashcardId = request.FlashcardId, Due = DateTime.UtcNow };

    var result = FsrsService.Review(srs, request.Rating, DateTime.UtcNow);

    srs.State = result.State;   srs.Stability    = result.Stability;
    srs.Difficulty = result.Difficulty;
    srs.Reps  = result.Reps;    srs.Lapses       = result.Lapses;
    srs.ScheduledDays = result.ScheduledDays;
    srs.ElapsedDays   = result.ElapsedDays;
    srs.LastReview    = result.LastReview;
    srs.Due           = result.Due;

    if (srs.Reps == 1)
        await _unitOfWork.FlashcardSrs.AddAsync(srs, cancellationToken);

    await _unitOfWork.SaveChangesAsync(cancellationToken);
    return Result<ReviewFlashcardResponse>.Success(
        new ReviewFlashcardResponse(result.ScheduledDays, result.Retrievability, ToSrsDto(srs)));
}
```

## FSRS-4.5 Algorithm

`FsrsService` is a pure-static implementation of the FSRS-4.5 algorithm. Ratings: 1=Again, 2=Hard, 3=Good, 4=Easy. States: 0=New, 1=Learning, 2=Review, 3=Relearning.

```csharp
// FsrsService.cs — pre-trained weight vector (19 params)
private static readonly double[] W =
[
    0.4072, 1.1829, 3.1262, 15.4722,
    7.2102, 0.5316, 1.0651, 0.0589,
    1.5330, 0.1544, 1.0070, 1.9395,
    0.1100, 0.2900, 2.2700, 0.2100,
    2.9898, 0.5100, 0.3400
];

private const double Factor = 19.0 / 81.0;
private const double Decay  = -0.5;

// Retrievability: R(t) = (1 + Factor * t/S)^Decay
private static double Retrievability(double stability, double elapsedDays)
    => Math.Pow(1 + Factor * elapsedDays / stability, Decay);

// Stability after a successful recall
private static double NextRecallStability(double d, double s, double r, int g)
{
    double hardPenalty = g == 2 ? W[15] : 1.0;
    double easyBonus   = g == 4 ? W[16] : 1.0;
    return s * Math.Exp(W[8]) * (11 - d)
             * Math.Pow(s, -W[9])
             * (Math.Exp(W[10] * (1 - r)) - 1)
             * hardPenalty * easyBonus;
}

// Stability after a lapse (Again rating in Review state)
private static double NextForgetStability(double d, double s, double r)
    => W[11] * Math.Pow(d, -W[12])
             * (Math.Pow(s + 1, W[13]) - 1)
             * Math.Exp(W[14] * (1 - r));

// Mean-reversion difficulty update
private static double UpdateDifficulty(double d, int g)
{
    double deltaD = -W[6] * (g - 3);
    double dNew   = d + deltaD * ((10.0 - d) / 9.0);
    double d04    = W[4] - Math.Exp(W[5] * 3) + 1;
    return W[7] * d04 + (1 - W[7]) * dNew;   // mean reversion towards W[4]
}
```

The state machine in `Review()` dispatches across New / Learning / Review / Relearning and returns the next `Due` date as `reviewedAt.Date + scheduledDays`.

## Frontend

The flashcard UI is in `FlashcardsPage`, `ReinforcementCenterPage`, and `web/src/components/study/*`. API calls are in `flashcardService.ts`.
