namespace StudyPlatform.Application.Share.Preview;

/// <summary>
/// The link-preview card a social network builds for one share link: what Slack, X, Facebook,
/// LinkedIn, WhatsApp and friends read out of the page's meta tags. Plain values — escaping and
/// tag syntax belong to <see cref="ISharePreviewHtmlRenderer"/>.
/// </summary>
/// <param name="Title">The share's own title, as the card headline.</param>
/// <param name="Description">Summary snippet plus the "shared by / what's inside" line.</param>
/// <param name="Url">Canonical URL of the share page — the link that was pasted.</param>
/// <param name="ImageUrl">Absolute URL of the card image.</param>
/// <param name="ImageWidth">Card image width in pixels.</param>
/// <param name="ImageHeight">Card image height in pixels.</param>
/// <param name="PublishedAtIso">When the share was created, or null when it is not a real share.</param>
public sealed record SharePreview(
    string Title,
    string Description,
    string Url,
    string ImageUrl,
    int ImageWidth,
    int ImageHeight,
    string? PublishedAtIso);
