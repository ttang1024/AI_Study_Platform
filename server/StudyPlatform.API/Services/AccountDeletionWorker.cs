using Microsoft.EntityFrameworkCore;
using StudyPlatform.Application.Security.Commands;
using StudyPlatform.Application.Services;
using StudyPlatform.Infrastructure.Data;

namespace StudyPlatform.API.Services;

/// <summary>
/// Erases accounts whose grace period has run out.
///
/// <para>Runs hourly, not continuously: the deadline is measured in days, so the only thing a
/// tighter loop would buy is load. Erasing one account per pass keeps a backlog from turning into a
/// single long transaction — the next pass is an hour away at worst, and nothing is waiting on it.</para>
/// </summary>
public sealed class AccountDeletionWorker : BackgroundService
{
    private static readonly TimeSpan SweepInterval = TimeSpan.FromHours(1);

    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<AccountDeletionWorker> _logger;

    public AccountDeletionWorker(IServiceScopeFactory scopeFactory, ILogger<AccountDeletionWorker> logger)
    {
        _scopeFactory = scopeFactory;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await SweepAsync(stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Account deletion sweep failed; will retry.");
            }

            try
            {
                await Task.Delay(SweepInterval, stoppingToken);
            }
            catch (OperationCanceledException)
            {
                break;
            }
        }
    }

    private async Task SweepAsync(CancellationToken cancellationToken)
    {
        using var scope = _scopeFactory.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        var cutoff = DateTime.UtcNow - RequestAccountDeletionCommandHandler.GracePeriod;

        var dueUserIds = await db.Users
            .AsNoTracking()
            .Where(u => u.DeletionRequestedAt != null && u.DeletionRequestedAt < cutoff)
            .Select(u => u.UserId)
            .ToListAsync(cancellationToken);

        if (dueUserIds.Count == 0)
            return;

        var eraser = scope.ServiceProvider.GetRequiredService<IAccountEraser>();
        var audit = scope.ServiceProvider.GetRequiredService<IAuditLogger>();

        foreach (var userId in dueUserIds)
        {
            try
            {
                // Written before the erase, because afterwards there is no user id left to write it
                // under — the entry is anonymised by the erase itself, which is the intended end state.
                await audit.LogAsync(AuditActions.AccountDeleted, userId, cancellationToken: cancellationToken);
                await eraser.EraseAsync(userId, cancellationToken);
            }
            catch (Exception ex)
            {
                // One account failing must not stop the rest. The row keeps its DeletionRequestedAt,
                // so the next sweep retries it.
                _logger.LogError(ex, "Failed to erase account {UserId}", userId);
            }
        }
    }
}
