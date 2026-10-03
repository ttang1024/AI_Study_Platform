namespace StudyPlatform.Application.Services;

/// <summary>A busy interval imported from an external calendar, in UTC.</summary>
public record BusyBlock(DateTime Start, DateTime End, string Title, bool AllDay);

public interface ICalendarFeedService
{
    /// <summary>
    /// Downloads an ICS feed and returns its events intersecting [from, to).
    /// Expands simple DAILY/WEEKLY recurrences. Throws on network/parse failure.
    /// </summary>
    Task<IReadOnlyList<BusyBlock>> FetchBusyBlocksAsync(string url, DateTime from, DateTime to, CancellationToken cancellationToken = default);
}
