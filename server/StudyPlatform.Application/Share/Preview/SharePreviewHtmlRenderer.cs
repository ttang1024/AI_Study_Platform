using System.Text;
using System.Text.RegularExpressions;

namespace StudyPlatform.Application.Share.Preview;

/// <inheritdoc />
public partial class SharePreviewHtmlRenderer : ISharePreviewHtmlRenderer
{
    public string Render(string shellHtml, SharePreview preview)
    {
        if (string.IsNullOrWhiteSpace(shellHtml)) return RenderStandalone(preview);

        var headEnd = shellHtml.LastIndexOf("</head>", StringComparison.OrdinalIgnoreCase);
        if (headEnd < 0) return RenderStandalone(preview);

        // TrimEnd + the tab put back in front of </head> keep the indentation tidy after the
        // stripped tags take their own leading whitespace with them.
        var head = StripGenericMetadata(shellHtml[..headEnd]).TrimEnd();
        var rest = ReplaceNoscript(shellHtml[headEnd..], preview);

        return head + "\n" + MetaTags(preview, indent: "\t\t") + "\t" + rest;
    }

    public string RenderStandalone(SharePreview preview) =>
        $"""
        <!doctype html>
        <html lang="en">
        	<head>
        		<meta charset="UTF-8" />
        		<meta name="viewport" content="width=device-width, initial-scale=1.0" />
        {MetaTags(preview, indent: "\t\t")}	</head>
        	<body>
        {NoscriptBody(preview, indent: "\t\t")}	</body>
        </html>
        """;

    /// <summary>
    /// Drops the tags index.html carries for the landing page. They are removed rather than
    /// rewritten in place because an unfurler that finds two og:title tags picks whichever it
    /// likes, and the landing copy would sometimes win.
    /// </summary>
    private static string StripGenericMetadata(string head)
    {
        head = TitleTag().Replace(head, string.Empty);
        head = SocialMetaTag().Replace(head, string.Empty);
        head = CanonicalLink().Replace(head, string.Empty);
        head = LdJsonScript().Replace(head, string.Empty);
        return head;
    }

    /// <summary>
    /// index.html's &lt;noscript&gt; mirrors the landing page. On a share page that copy is wrong,
    /// and it is the only text a no-JS reader gets — so it becomes this share's text instead.
    /// The comment above it in index.html explains that mirroring, so it goes too.
    /// </summary>
    private static string ReplaceNoscript(string html, SharePreview preview) =>
        NoscriptBlock().Replace(html, _ => NoscriptBody(preview, indent: "\t\t").TrimEnd('\n'), 1);

    private static string MetaTags(SharePreview preview, string indent)
    {
        var title = Attr(preview.Title);
        var description = Attr(preview.Description);
        var url = Attr(preview.Url);
        var image = Attr(preview.ImageUrl);

        var tags = new StringBuilder();
        void Line(string tag) => tags.Append(indent).Append(tag).Append('\n');

        Line($"<title>{Text(preview.Title)} · Toto Study</title>");
        Line($"""<meta name="description" content="{description}" />""");
        Line($"""<link rel="canonical" href="{url}" />""");
        // Share links are public-by-token, not public-to-search: robots.txt keeps crawlers off
        // /share/ entirely, and this is the belt to that pair of braces. Unfurlers are not
        // indexers and ignore it, so rich previews are unaffected.
        Line("""<meta name="googlebot" content="noindex, nofollow" />""");
        Line("""<meta property="og:type" content="article" />""");
        Line("""<meta property="og:site_name" content="Toto Study" />""");
        Line($"""<meta property="og:title" content="{title}" />""");
        Line($"""<meta property="og:description" content="{description}" />""");
        Line($"""<meta property="og:url" content="{url}" />""");
        Line($"""<meta property="og:image" content="{image}" />""");
        Line($"""<meta property="og:image:secure_url" content="{image}" />""");
        Line("""<meta property="og:image:type" content="image/png" />""");
        Line($"""<meta property="og:image:width" content="{preview.ImageWidth}" />""");
        Line($"""<meta property="og:image:height" content="{preview.ImageHeight}" />""");
        Line($"""<meta property="og:image:alt" content="{title}" />""");
        if (preview.PublishedAtIso is not null)
            Line($"""<meta property="article:published_time" content="{Attr(preview.PublishedAtIso)}" />""");
        Line("""<meta name="twitter:card" content="summary_large_image" />""");
        Line($"""<meta name="twitter:title" content="{title}" />""");
        Line($"""<meta name="twitter:description" content="{description}" />""");
        Line($"""<meta name="twitter:image" content="{image}" />""");
        Line($"""<meta name="twitter:image:alt" content="{title}" />""");
        // WeChat reads its own namespace before falling back to og:*.
        Line($"""<meta name="wechat:title" content="{title}" />""");
        Line($"""<meta name="wechat:description" content="{description}" />""");
        Line($"""<meta name="wechat:image" content="{image}" />""");
        Line($"""<meta name="image_src" content="{image}" />""");

        return tags.ToString();
    }

    private static string NoscriptBody(SharePreview preview, string indent)
    {
        var body = new StringBuilder();
        body.Append(indent).Append("<noscript>\n");
        body.Append(indent).Append("\t<h1>").Append(Text(preview.Title)).Append("</h1>\n");

        foreach (var paragraph in preview.Description.Split('\n', StringSplitOptions.RemoveEmptyEntries))
            body.Append(indent).Append("\t<p>").Append(Text(paragraph.Trim())).Append("</p>\n");

        body.Append(indent).Append("\t<p><a href=\"").Append(Attr(preview.Url)).Append("\">Open this on Toto Study</a></p>\n");
        body.Append(indent).Append("</noscript>\n");
        return body.ToString();
    }

    /// <summary>
    /// Attribute-safe text. The newline between the snippet and the attribution line is legal
    /// inside a quoted attribute but mangled by enough scrapers to be worth encoding.
    /// </summary>
    private static string Attr(string value) =>
        Text(value).Replace("\r", string.Empty).Replace("\n", "&#10;");

    /// <summary>
    /// Escapes only what HTML syntax requires. WebUtility.HtmlEncode would also turn every
    /// non-ASCII character into a numeric entity, which a CJK title turns into an unreadable wall
    /// of them — and the page is UTF-8, so those characters need no escaping at all.
    /// </summary>
    private static string Text(string value) => (value ?? string.Empty)
        .Replace("&", "&amp;")
        .Replace("<", "&lt;")
        .Replace(">", "&gt;")
        .Replace("\"", "&quot;")
        .Replace("'", "&#39;");

    [GeneratedRegex(@"<title\b[^>]*>.*?</title>\s*", RegexOptions.IgnoreCase | RegexOptions.Singleline)]
    private static partial Regex TitleTag();

    [GeneratedRegex(
        """<meta\b[^>]*\b(?:property|name)\s*=\s*"(?:og:[^"]*|twitter:[^"]*|wechat:[^"]*|description|image_src)"[^>]*>\s*""",
        RegexOptions.IgnoreCase)]
    private static partial Regex SocialMetaTag();

    [GeneratedRegex("""<link\b[^>]*\brel\s*=\s*"canonical"[^>]*>\s*""", RegexOptions.IgnoreCase)]
    private static partial Regex CanonicalLink();

    [GeneratedRegex(
        """<script\b[^>]*\btype\s*=\s*"application/ld\+json"[^>]*>.*?</script>\s*""",
        RegexOptions.IgnoreCase | RegexOptions.Singleline)]
    private static partial Regex LdJsonScript();

    [GeneratedRegex(
        @"(?:[ \t]*<!--.*?-->[ \t]*\r?\n)?[ \t]*<noscript\b[^>]*>.*?</noscript>",
        RegexOptions.IgnoreCase | RegexOptions.Singleline)]
    private static partial Regex NoscriptBlock();
}
