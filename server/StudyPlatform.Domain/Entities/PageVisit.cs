namespace StudyPlatform.Domain.Entities;

/// <summary>
/// One page view in the web app: the route a visitor landed on, with just enough context to
/// aggregate it later (who, which browser, where they came from).
///
/// <para>Anonymous traffic is the point — the landing page, login, a shared link — so
/// <see cref="UserId"/> is nullable and <see cref="VisitorId"/> carries the browser-scoped id the
/// client mints. That id is random and stored only here; it counts unique visitors without
/// identifying anyone.</para>
///
/// <para><see cref="Path"/> is a normalised route pattern, never the raw URL: ids are collapsed to
/// <c>:id</c> and the query string is dropped, so "/documents/:id" aggregates and no document id,
/// search term or share token is retained.</para>
/// </summary>
public class PageVisit
{
    public Guid Id { get; set; }

    /// <summary>Null for visitors who are not signed in.</summary>
    public Guid? UserId { get; set; }

    /// <summary>Random browser-scoped id from the client; survives tabs and reloads.</summary>
    public string VisitorId { get; set; } = string.Empty;

    /// <summary>Normalised route pattern, e.g. "/library" or "/documents/:id".</summary>
    public string Path { get; set; } = string.Empty;

    /// <summary>Referring origin (scheme + host), or null for direct and same-site navigation.</summary>
    public string? Referrer { get; set; }

    public DateTime OccurredAt { get; set; }

    public User? User { get; set; }
}
