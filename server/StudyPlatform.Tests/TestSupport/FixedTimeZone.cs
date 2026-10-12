using StudyPlatform.Application.Common;

namespace StudyPlatform.Tests.TestSupport;

/// <summary>An <see cref="IUserTimeZone"/> that answers one zone for every user; UTC unless told otherwise.</summary>
public sealed class FixedTimeZone : IUserTimeZone
{
    private readonly TimeZoneInfo _zone;

    public FixedTimeZone(string? ianaId = null) => _zone = UserCalendar.Resolve(ianaId);

    public static FixedTimeZone Utc { get; } = new();

    public Task<TimeZoneInfo> ForUserAsync(Guid userId, CancellationToken cancellationToken = default) => Task.FromResult(_zone);
}
