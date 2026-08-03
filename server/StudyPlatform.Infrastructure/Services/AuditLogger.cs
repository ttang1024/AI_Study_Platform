using System.Text.Json;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using StudyPlatform.Application.Services;
using StudyPlatform.Domain.Entities;
using StudyPlatform.Infrastructure.Data;

namespace StudyPlatform.Infrastructure.Services;

/// <summary>
/// Writes audit rows on a scope of its own, for two reasons that pull the same way.
///
/// <para>The trail must survive the operation failing — "somebody tried to do this and it was
/// refused" is the entry an investigation most wants, and enlisting in the caller's unit of work
/// would roll exactly those entries back. And the trail must never be the thing that fails the
/// operation, so every write is wrapped and swallowed.</para>
/// </summary>
public class AuditLogger : IAuditLogger
{
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly IHttpContextAccessor _httpContextAccessor;
    private readonly ILogger<AuditLogger> _logger;

    public AuditLogger(
        IServiceScopeFactory scopeFactory,
        IHttpContextAccessor httpContextAccessor,
        ILogger<AuditLogger> logger)
    {
        _scopeFactory = scopeFactory;
        _httpContextAccessor = httpContextAccessor;
        _logger = logger;
    }

    public async Task LogAsync(
        string action,
        Guid? actorUserId = null,
        Guid? subjectUserId = null,
        string? targetType = null,
        string? targetId = null,
        object? metadata = null,
        CancellationToken cancellationToken = default)
    {
        try
        {
            var http = _httpContextAccessor.HttpContext;

            using var scope = _scopeFactory.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

            db.AuditLogEntries.Add(new AuditLogEntry
            {
                AuditLogEntryId = Guid.NewGuid(),
                ActorUserId = actorUserId,
                SubjectUserId = subjectUserId ?? actorUserId,
                Action = action,
                TargetType = targetType,
                TargetId = targetId,
                MetadataJson = metadata == null ? null : JsonSerializer.Serialize(metadata),
                IpAddress = ResolveIpAddress(http),
                UserAgent = Truncate(http?.Request.Headers.UserAgent.ToString(), 512),
                CreatedAt = DateTime.UtcNow,
            });

            await db.SaveChangesAsync(cancellationToken);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to write audit entry {Action} for actor {ActorUserId}", action, actorUserId);
        }
    }

    /// <summary>
    /// Prefers the left-most <c>X-Forwarded-For</c> hop, since the platform runs behind a load
    /// balancer and <see cref="ConnectionInfo.RemoteIpAddress"/> would otherwise record the balancer
    /// for every entry. The header is client-controlled and therefore spoofable — it is recorded as
    /// a lead, not as proof, and nothing authorizes off it.
    /// </summary>
    private static string? ResolveIpAddress(HttpContext? http)
    {
        if (http == null)
            return null;

        var forwarded = http.Request.Headers["X-Forwarded-For"].ToString();
        if (!string.IsNullOrWhiteSpace(forwarded))
            return Truncate(forwarded.Split(',')[0].Trim(), 64);

        return Truncate(http.Connection.RemoteIpAddress?.ToString(), 64);
    }

    private static string? Truncate(string? value, int maxLength)
    {
        if (string.IsNullOrWhiteSpace(value))
            return null;
        return value.Length <= maxLength ? value : value[..maxLength];
    }
}
