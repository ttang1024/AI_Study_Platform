using StudyPlatform.Domain.Entities;

namespace StudyPlatform.Application.Share.Preview;

/// <inheritdoc />
public class SharePreviewFactory : ISharePreviewFactory
{
    /// <summary>
    /// Unfurlers cut the description off somewhere between 200 and 300 characters, and the
    /// "shared by / what's inside" line has to survive that cut — so the snippet gets the rest.
    /// </summary>
    private const int SnippetMaxLength = 180;

    /// <summary>Long titles are the unfurler's problem to ellipsise, but not unboundedly.</summary>
    private const int TitleMaxLength = 110;

    // web/public/share.png — the designed card the landing page already shares.
    private const string CardImagePath = "/share.png";
    private const int CardImageWidth = 1200;
    private const int CardImageHeight = 1200;

    private readonly ISummarySnippetExtractor _snippets;
    private readonly IShareContentsInventory _inventory;

    public SharePreviewFactory(ISummarySnippetExtractor snippets, IShareContentsInventory inventory)
    {
        _snippets = snippets;
        _inventory = inventory;
    }

    public SharePreview Create(ShareToken share, string origin)
    {
        var baseUrl = Normalize(origin);
        var title = Shorten(share.Title, TitleMaxLength);

        return new SharePreview(
            Title: string.IsNullOrWhiteSpace(title) ? "Shared study material" : title,
            Description: BuildDescription(share),
            Url: $"{baseUrl}/share/{share.Token}",
            ImageUrl: $"{baseUrl}{CardImagePath}",
            ImageWidth: CardImageWidth,
            ImageHeight: CardImageHeight,
            PublishedAtIso: share.CreatedAt.ToUniversalTime().ToString("O"));
    }

    public SharePreview CreateUnavailable(string token, string origin)
    {
        var baseUrl = Normalize(origin);

        return new SharePreview(
            Title: "Shared study material",
            Description: "This share link has expired or no longer exists. Turn your own documents, "
                + "videos, podcasts and articles into summaries, mind maps, flashcards and quizzes on Toto Study.",
            Url: $"{baseUrl}/share/{token}",
            ImageUrl: $"{baseUrl}{CardImagePath}",
            ImageWidth: CardImageWidth,
            ImageHeight: CardImageHeight,
            PublishedAtIso: null);
    }

    /// <summary>
    /// Snippet of the summary first — it is the part that tells a reader whether the link is worth
    /// opening — then who shared it and what is inside.
    /// </summary>
    private string BuildDescription(ShareToken share)
    {
        var snippet = _snippets.Extract(share.Summary, SnippetMaxLength);
        var owner = string.IsNullOrWhiteSpace(share.Owner?.FullName) ? "a Toto Study user" : share.Owner!.FullName.Trim();
        var contents = _inventory.Describe(share);

        var attribution = contents.Length > 0
            ? $"Shared by {owner} · {contents}"
            : $"Shared by {owner} on Toto Study";

        return snippet.Length > 0 ? $"{snippet}\n\n{attribution}" : attribution;
    }

    /// <summary>
    /// og:image and og:url are read off-site, so both have to be absolute — a relative path
    /// resolves against the crawler's own host, or not at all. A Web:PublicOrigin configured
    /// without a scheme ("toto-study.com") would otherwise build "toto-study.com/share.png",
    /// which no unfurler can fetch, so the scheme is assumed rather than left missing.
    /// </summary>
    private static string Normalize(string origin)
    {
        var value = (origin ?? string.Empty).Trim().TrimEnd('/');

        return value.Length == 0 || value.Contains("://", StringComparison.Ordinal)
            ? value
            : $"https://{value}";
    }

    private static string Shorten(string? text, int maxLength)
    {
        var value = (text ?? string.Empty).Trim();
        if (value.Length <= maxLength) return value;

        var cut = value[..maxLength];
        var lastSpace = cut.LastIndexOf(' ');
        if (lastSpace > maxLength / 2) cut = cut[..lastSpace];

        return cut.TrimEnd() + "…";
    }
}
