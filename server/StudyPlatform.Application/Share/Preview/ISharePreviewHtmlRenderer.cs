namespace StudyPlatform.Application.Share.Preview;

/// <summary>
/// Writes a <see cref="SharePreview"/> into HTML a crawler can read.
/// </summary>
public interface ISharePreviewHtmlRenderer
{
    /// <summary>
    /// Returns the SPA shell with the landing page's generic metadata swapped for this share's.
    /// The rest of the document — script and stylesheet tags above all — is left alone, so the app
    /// still boots and hydrates exactly as it does when the shell is served straight from the CDN.
    /// </summary>
    string Render(string shellHtml, SharePreview preview);

    /// <summary>
    /// A self-contained page carrying the same metadata, for when the shell cannot be fetched.
    /// The crawler still gets its card; a human gets the card's text and a way into the app.
    /// </summary>
    string RenderStandalone(SharePreview preview);
}
