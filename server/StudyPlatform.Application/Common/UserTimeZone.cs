using StudyPlatform.Application.Services;
using StudyPlatform.Domain.Interfaces;

namespace StudyPlatform.Application.Common;

/// <summary>Which time zone a user's days are counted in.</summary>
public interface IUserTimeZone
{
    /// <summary>
    /// The calling device's zone when the request names one, else the zone saved on the account, else
    /// UTC. The device wins so a user who travels sees days that match their clock; background work has
    /// no request and falls through to the saved zone.
    /// </summary>
    Task<TimeZoneInfo> ForUserAsync(Guid userId, CancellationToken cancellationToken = default);
}

/// <inheritdoc cref="IUserTimeZone"/>
public sealed class UserTimeZone : IUserTimeZone
{
    private readonly IRequestContext _requestContext;
    private readonly IUserRepository _users;

    public UserTimeZone(IRequestContext requestContext, IUserRepository users)
    {
        _requestContext = requestContext;
        _users = users;
    }

    public async Task<TimeZoneInfo> ForUserAsync(Guid userId, CancellationToken cancellationToken = default)
    {
        if (_requestContext.TimeZone is { } fromDevice)
            return UserCalendar.Resolve(fromDevice);

        var user = await _users.GetByIdAsync(userId, cancellationToken);
        return UserCalendar.Resolve(user?.TimeZone);
    }
}
