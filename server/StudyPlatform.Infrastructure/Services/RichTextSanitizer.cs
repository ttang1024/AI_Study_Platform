using Ganss.Xss;
using StudyPlatform.Application.Services;

namespace StudyPlatform.Infrastructure.Services;

/// <summary>
/// <see cref="IRichTextSanitizer"/> over the HtmlSanitizer library's allowlist. Its defaults already
/// keep everything the rich-text editor produces (headings, lists, tables, code, links, images, inline
/// styles) and drop script, event handlers, frames, forms and non-http(s) URLs.
///
/// <para>Singleton: an HtmlSanitizer instance is safe to share across threads once configured.</para>
/// </summary>
public sealed class RichTextSanitizer : IRichTextSanitizer
{
    private readonly HtmlSanitizer _sanitizer;

    public RichTextSanitizer()
    {
        _sanitizer = new HtmlSanitizer();
        _sanitizer.AllowedSchemes.Add("mailto");
    }

    public string Sanitize(string html) => _sanitizer.Sanitize(html);
}
