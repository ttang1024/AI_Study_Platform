using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using StudyPlatform.Application.Services;
using StudyPlatform.Application.Settings;
using StudyPlatform.Infrastructure.Data;

namespace StudyPlatform.API.Services;

/// <summary>
/// Sends at most one push reminder (browser Web Push or mobile Expo push) per
/// device per day to users whose FSRS
/// flashcards are due. Checks hourly; the per-device LastNotifiedAt timestamp is
/// the throttle, so users get the reminder roughly when their cards come due
/// rather than at a fixed global hour.
/// </summary>
public sealed class DueReviewPushWorker : PeriodicSweepWorker
{
    private static readonly TimeSpan CheckInterval = TimeSpan.FromHours(1);
    private static readonly TimeSpan MinTimeBetweenPushes = TimeSpan.FromHours(20);

    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<DueReviewPushWorker> _logger;
    private readonly VapidOptions _vapid;

    public DueReviewPushWorker(
        IServiceScopeFactory scopeFactory,
        IOptions<VapidOptions> vapid,
        ILogger<DueReviewPushWorker> logger)
        : base(logger)
    {
        _scopeFactory = scopeFactory;
        _logger = logger;
        _vapid = vapid.Value;
    }

    protected override TimeSpan SweepInterval => CheckInterval;

    protected override string SweepName => "Due-review push";

    protected override Task<bool> OnStartingAsync(CancellationToken cancellationToken)
    {
        if (!_vapid.IsConfigured)
        {
            // Browser deliveries are skipped inside the push service; mobile Expo-token
            // deliveries need no VAPID keys, so the sweep still runs.
            _logger.LogInformation("Web push disabled: no VAPID keys configured — due-review reminders go to mobile devices only");
        }

        return Task.FromResult(true);
    }

    protected override Task SweepAsync(CancellationToken cancellationToken)
        => NotifyUsersWithDueCardsAsync(cancellationToken);

    private async Task NotifyUsersWithDueCardsAsync(CancellationToken ct)
    {
        await using var scope = _scopeFactory.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var push = scope.ServiceProvider.GetRequiredService<IPushNotificationService>();

        var now = DateTime.UtcNow;
        var cutoff = now - MinTimeBetweenPushes;

        // Users who own a subscription that hasn't been pinged within the throttle window.
        var candidateUserIds = await db.UserPushSubscriptions
            .Where(s => s.LastNotifiedAt == null || s.LastNotifiedAt < cutoff)
            .Select(s => s.UserId)
            .Distinct()
            .ToListAsync(ct);
        if (candidateUserIds.Count == 0) return;

        var dueCounts = await db.FlashcardSrs
            .Where(s => candidateUserIds.Contains(s.UserId) && s.Due <= now)
            .GroupBy(s => s.UserId)
            .Select(g => new { UserId = g.Key, Count = g.Count() })
            .ToListAsync(ct);

        foreach (var entry in dueCounts)
        {
            var title = "Time to review";
            var body = entry.Count == 1
                ? "1 flashcard is due for review — a minute is all it takes."
                : $"{entry.Count} flashcards are due for review. Keep the streak alive!";
            await push.SendToUserAsync(entry.UserId, title, body, "/flashcards?tab=review", ct);
        }
    }
}
