namespace StudyPlatform.Domain.Entities;

/// <summary>
/// A URL the platform posts events to.
///
/// <para>The URL is supplied by the user and fetched by the server, which makes every delivery an
/// SSRF vector — it goes out through the same guarded HTTP client as calendar and podcast ingestion,
/// never a plain <c>HttpClient</c>.</para>
/// </summary>
public class Webhook
{
    public Guid WebhookId { get; set; }
    public Guid UserId { get; set; }

    public string Url { get; set; } = string.Empty;

    /// <summary>
    /// Shared secret used to sign each delivery, so the receiver can tell a real event from anyone
    /// who guessed their endpoint. Stored recoverably because signing requires the key itself.
    /// </summary>
    public string Secret { get; set; } = string.Empty;

    /// <summary>Comma-separated <see cref="WebhookEvents"/> names this endpoint wants.</summary>
    public string Events { get; set; } = string.Empty;

    public bool IsActive { get; set; } = true;

    public DateTime? LastDeliveryAt { get; set; }

    /// <summary>HTTP status of the last attempt, or null if it never got a response.</summary>
    public int? LastStatusCode { get; set; }

    /// <summary>
    /// Consecutive failures. Reset by any success.
    ///
    /// <para>Once it passes the disable threshold the endpoint is switched off rather than retried
    /// forever: a URL that has failed dozens of times running is gone, and continuing to post to it
    /// is a slow outbound flood against someone else's server.</para>
    /// </summary>
    public int ConsecutiveFailures { get; set; }

    public DateTime CreatedAt { get; set; }

    public User User { get; set; } = null!;
}

public static class WebhookEvents
{
    public const string DocumentCreated = "document.created";
    public const string FlashcardsGenerated = "flashcards.generated";
    public const string QuizCompleted = "quiz.completed";
    public const string ReviewsDue = "reviews.due";
    public const string CertificateIssued = "certificate.issued";

    public static readonly IReadOnlyList<string> All = new[]
    {
        DocumentCreated, FlashcardsGenerated, QuizCompleted, ReviewsDue, CertificateIssued,
    };

    public static bool IsValid(string name) => All.Contains(name);
}
