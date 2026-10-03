using StudyPlatform.Domain.Entities;

namespace StudyPlatform.Tests.TestSupport;

/// <summary>Review-log fixtures for the FSRS weight optimizer and the settings handler that drives it.</summary>
public static class ReviewHistory
{
    /// <summary>
    /// A history of cards that keep being recalled after ever-longer gaps — a learner whose real
    /// memory is far more durable than the stock weights assume, which is exactly what a fit
    /// should catch.
    /// </summary>
    public static List<FlashcardReviewLog> Durable(Guid userId, int cards = 60, int reviewsPerCard = 10)
    {
        var logs = new List<FlashcardReviewLog>();
        var start = new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc);

        for (var c = 0; c < cards; c++)
        {
            var cardId = Guid.NewGuid();
            var at = start;

            for (var i = 0; i < reviewsPerCard; i++)
            {
                var elapsed = i == 0 ? 0 : 10 + i * 10;
                at = at.AddDays(elapsed);
                logs.Add(new FlashcardReviewLog
                {
                    Id = Guid.NewGuid(),
                    UserId = userId,
                    FlashcardId = cardId,
                    Rating = 3,
                    StateBefore = i == 0 ? 0 : 2,
                    ElapsedDays = elapsed,
                    ReviewedAt = at,
                });
            }
        }

        return logs;
    }
}
