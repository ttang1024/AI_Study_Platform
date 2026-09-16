namespace StudyPlatform.Application.Share.Preview;

/// <summary>
/// Turns a stored AI summary (markdown) into the one-paragraph plain-text snippet a link preview
/// can show. Separate from <see cref="ISharePreviewFactory"/> because it changes for markdown
/// reasons, not for card-layout reasons.
/// </summary>
public interface ISummarySnippetExtractor
{
    /// <summary>
    /// Returns the summary's opening paragraph as plain text, cut to <paramref name="maxLength"/>
    /// on a word boundary with an ellipsis. Empty when there is nothing usable to show.
    /// </summary>
    string Extract(string? markdown, int maxLength);
}
