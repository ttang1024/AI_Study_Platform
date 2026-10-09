namespace StudyPlatform.Application.Services;

/// <summary>
/// Strips active content (scripts, event-handler attributes, <c>javascript:</c> URLs, frames, forms)
/// from user-authored rich-text HTML while keeping its formatting.
///
/// <para>Anything a user writes that another person's browser will render as HTML — today, the notes
/// on a public share link — must pass through this first. Clients render that HTML as markup, so an
/// unsanitized value is stored XSS against whoever opens the link.</para>
/// </summary>
public interface IRichTextSanitizer
{
    string Sanitize(string html);
}
