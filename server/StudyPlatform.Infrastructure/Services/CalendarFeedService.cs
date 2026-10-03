using System.Globalization;
using StudyPlatform.Application.Services;

namespace StudyPlatform.Infrastructure.Services;

/// <summary>
/// Minimal ICS reader for "secret address" calendar feeds (Google/Outlook/Apple).
/// Handles line unfolding, all-day and timed events, TZID/UTC times, and expands
/// DAILY/WEEKLY RRULEs (INTERVAL, BYDAY, UNTIL, COUNT) — enough for class/work schedules.
/// </summary>
public class CalendarFeedService : ICalendarFeedService
{
    private readonly HttpClient _httpClient;

    public CalendarFeedService(HttpClient httpClient)
    {
        _httpClient = httpClient;
    }

    public async Task<IReadOnlyList<BusyBlock>> FetchBusyBlocksAsync(string url, DateTime from, DateTime to, CancellationToken ct = default)
    {
        // Apple/Google publish webcal:// URLs; it's plain HTTPS underneath.
        if (url.StartsWith("webcal://", StringComparison.OrdinalIgnoreCase))
            url = "https://" + url["webcal://".Length..];

        var ics = await _httpClient.GetStringAsync(url, ct);
        return ParseBusyBlocks(ics, from, to);
    }

    public static IReadOnlyList<BusyBlock> ParseBusyBlocks(string ics, DateTime from, DateTime to)
    {
        var blocks = new List<BusyBlock>();
        foreach (var vevent in ExtractEvents(Unfold(ics)))
        {
            var start = ParseIcsTime(vevent.GetValueOrDefault("DTSTART"), out var allDay);
            if (start == null)
                continue;

            var end = ParseIcsTime(vevent.GetValueOrDefault("DTEND"), out _)
                ?? (allDay ? start.Value.AddDays(1) : start.Value.AddHours(1));
            var duration = end - start.Value;
            if (duration <= TimeSpan.Zero)
                duration = allDay ? TimeSpan.FromDays(1) : TimeSpan.FromHours(1);

            var title = vevent.GetValueOrDefault("SUMMARY", "Busy");
            // Transparent events explicitly don't block time (e.g. "Birthdays" calendars).
            if (string.Equals(vevent.GetValueOrDefault("TRANSP"), "TRANSPARENT", StringComparison.OrdinalIgnoreCase))
                continue;

            var rrule = vevent.GetValueOrDefault("RRULE");
            if (string.IsNullOrEmpty(rrule))
            {
                AddIfInRange(blocks, start.Value, duration, title, allDay, from, to);
                continue;
            }

            foreach (var occurrence in ExpandRecurrence(start.Value, rrule, from, to))
                AddIfInRange(blocks, occurrence, duration, title, allDay, from, to);
        }

        return blocks.OrderBy(b => b.Start).ToList();
    }

    private static void AddIfInRange(List<BusyBlock> blocks, DateTime start, TimeSpan duration, string title, bool allDay, DateTime from, DateTime to)
    {
        var end = start + duration;
        if (end > from && start < to)
            blocks.Add(new BusyBlock(start, end, title, allDay));
    }

    // ── ICS plumbing ────────────────────────────────────────────────────────

    private static string[] Unfold(string ics)
        => ics.Replace("\r\n", "\n").Replace("\n ", "").Replace("\n\t", "").Split('\n');

    private static IEnumerable<Dictionary<string, string>> ExtractEvents(string[] lines)
    {
        Dictionary<string, string>? current = null;
        foreach (var line in lines)
        {
            if (line.StartsWith("BEGIN:VEVENT", StringComparison.Ordinal))
            {
                current = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
                continue;
            }
            if (line.StartsWith("END:VEVENT", StringComparison.Ordinal))
            {
                if (current != null)
                    yield return current;
                current = null;
                continue;
            }
            if (current == null)
                continue;

            var colon = line.IndexOf(':');
            if (colon <= 0)
                continue;
            var key = line[..colon];
            var value = line[(colon + 1)..].Trim();

            // Keep parameters on DTSTART/DTEND (needed for VALUE=DATE / TZID); strip elsewhere.
            var semi = key.IndexOf(';');
            var name = semi > 0 ? key[..semi] : key;
            if (name is "DTSTART" or "DTEND")
                current[name] = key + ":" + value; // preserve full "PROP;PARAMS:value"
            else
                current.TryAdd(name, value);
        }
    }

    /// <summary>Parses "PROP;PARAMS:value" (as stored above) or a bare value into a UTC DateTime.</summary>
    private static DateTime? ParseIcsTime(string? raw, out bool allDay)
    {
        allDay = false;
        if (string.IsNullOrEmpty(raw))
            return null;

        var colon = raw.IndexOf(':');
        var parameters = colon > 0 ? raw[..colon] : "";
        var value = colon > 0 ? raw[(colon + 1)..] : raw;

        if (parameters.Contains("VALUE=DATE", StringComparison.OrdinalIgnoreCase)
            || (value.Length == 8 && !value.Contains('T')))
        {
            allDay = true;
            return DateTime.TryParseExact(value, "yyyyMMdd", CultureInfo.InvariantCulture, DateTimeStyles.None, out var d)
                ? DateTime.SpecifyKind(d, DateTimeKind.Utc)
                : null;
        }

        var isUtc = value.EndsWith('Z');
        var timePart = isUtc ? value[..^1] : value;
        if (!DateTime.TryParseExact(timePart, "yyyyMMdd'T'HHmmss", CultureInfo.InvariantCulture, DateTimeStyles.None, out var dt))
            return null;

        if (isUtc)
            return DateTime.SpecifyKind(dt, DateTimeKind.Utc);

        // TZID-qualified or floating local time: convert when the zone resolves, else treat as UTC.
        var tzid = parameters.Split(';')
            .Select(p => p.Split('='))
            .Where(p => p.Length == 2 && p[0].Equals("TZID", StringComparison.OrdinalIgnoreCase))
            .Select(p => p[1])
            .FirstOrDefault();
        if (tzid != null)
        {
            try
            {
                var zone = TimeZoneInfo.FindSystemTimeZoneById(tzid);
                return TimeZoneInfo.ConvertTimeToUtc(DateTime.SpecifyKind(dt, DateTimeKind.Unspecified), zone);
            }
            catch (TimeZoneNotFoundException) { }
            catch (InvalidTimeZoneException) { }
        }
        return DateTime.SpecifyKind(dt, DateTimeKind.Utc);
    }

    // ── Recurrence ──────────────────────────────────────────────────────────

    private static readonly Dictionary<string, DayOfWeek> ByDayMap = new()
    {
        ["MO"] = DayOfWeek.Monday, ["TU"] = DayOfWeek.Tuesday, ["WE"] = DayOfWeek.Wednesday,
        ["TH"] = DayOfWeek.Thursday, ["FR"] = DayOfWeek.Friday, ["SA"] = DayOfWeek.Saturday, ["SU"] = DayOfWeek.Sunday,
    };

    private static IEnumerable<DateTime> ExpandRecurrence(DateTime first, string rrule, DateTime from, DateTime to)
    {
        var parts = rrule.Split(';')
            .Select(p => p.Split('='))
            .Where(p => p.Length == 2)
            .ToDictionary(p => p[0].ToUpperInvariant(), p => p[1], StringComparer.OrdinalIgnoreCase);

        var freq = parts.GetValueOrDefault("FREQ", "").ToUpperInvariant();
        if (freq is not ("DAILY" or "WEEKLY"))
        {
            // MONTHLY/YEARLY etc.: emit only the first occurrence rather than guessing.
            yield return first;
            yield break;
        }

        var interval = int.TryParse(parts.GetValueOrDefault("INTERVAL"), out var i) && i > 0 ? i : 1;
        DateTime? until = null;
        if (parts.TryGetValue("UNTIL", out var untilRaw))
            until = ParseIcsTime("UNTIL:" + untilRaw, out _);
        var count = int.TryParse(parts.GetValueOrDefault("COUNT"), out var c) && c > 0 ? c : int.MaxValue;

        var byDays = parts.TryGetValue("BYDAY", out var byDayRaw)
            ? byDayRaw.Split(',').Select(d => ByDayMap.GetValueOrDefault(d.Trim().ToUpperInvariant(), (DayOfWeek)(-1)))
                .Where(d => (int)d >= 0).ToHashSet()
            : null;

        var emitted = 0;
        var cursor = first;
        // Hard cap guards against pathological rules.
        for (var steps = 0; steps < 1000 && emitted < count && cursor < to; steps++)
        {
            if (until.HasValue && cursor > until.Value)
                yield break;

            if (freq == "DAILY")
            {
                emitted++;
                if (cursor + TimeSpan.FromDays(1) > from)
                    yield return cursor;
                cursor = cursor.AddDays(interval);
                continue;
            }

            // WEEKLY: emit each BYDAY inside the current week, then jump INTERVAL weeks.
            var weekDays = byDays is { Count: > 0 } ? byDays : new HashSet<DayOfWeek> { first.DayOfWeek };
            for (var d = 0; d < 7 && emitted < count; d++)
            {
                var day = cursor.AddDays(d);
                if (!weekDays.Contains(day.DayOfWeek) || day < first)
                    continue;
                if (until.HasValue && day > until.Value)
                    yield break;
                emitted++;
                if (day + TimeSpan.FromDays(1) > from && day < to)
                    yield return day;
            }
            cursor = cursor.AddDays(7 * interval);
        }
    }
}
