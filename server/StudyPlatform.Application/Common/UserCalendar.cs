namespace StudyPlatform.Application.Common;

/// <summary>
/// Calendar days as the user lives them. Timestamps are stored in UTC, but "today", a streak day or a
/// day's study total has to follow the user's own midnight — bucketing on <c>OccurredAt.Date</c> put a
/// New Zealand user's 9am session on the previous day.
///
/// <para>A calendar date is represented the way the schema already stores one: midnight of that date
/// with <see cref="DateTimeKind.Utc"/>. Only the meaning of "which date" changes.</para>
/// </summary>
public static class UserCalendar
{
    public static bool IsKnownZone(string? id)
        => !string.IsNullOrWhiteSpace(id) && id.Length <= 64 && TimeZoneInfo.TryFindSystemTimeZoneById(id, out _);

    /// <summary>The zone for <paramref name="id"/>, or UTC when it is missing or unknown.</summary>
    public static TimeZoneInfo Resolve(string? id)
        => IsKnownZone(id) && TimeZoneInfo.TryFindSystemTimeZoneById(id!, out var zone) ? zone : TimeZoneInfo.Utc;

    /// <summary>The user's calendar date at the UTC instant <paramref name="utcInstant"/>.</summary>
    public static DateTime LocalDate(DateTime utcInstant, TimeZoneInfo zone)
    {
        var local = TimeZoneInfo.ConvertTimeFromUtc(DateTime.SpecifyKind(utcInstant, DateTimeKind.Utc), zone);
        return DateTime.SpecifyKind(local.Date, DateTimeKind.Utc);
    }

    /// <summary>The UTC instant at which the user's calendar date <paramref name="localDate"/> begins.</summary>
    public static DateTime StartOfDayUtc(DateTime localDate, TimeZoneInfo zone)
    {
        var midnight = DateTime.SpecifyKind(localDate.Date, DateTimeKind.Unspecified);

        // A DST jump at midnight (some zones spring forward at 00:00) makes local midnight not exist;
        // the day then starts at the first valid local time, an hour later.
        while (zone.IsInvalidTime(midnight))
            midnight = midnight.AddMinutes(30);

        return TimeZoneInfo.ConvertTimeToUtc(midnight, zone);
    }
}
