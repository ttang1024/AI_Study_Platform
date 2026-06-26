using System.Text.RegularExpressions;

namespace StudyPlatform.API.Services;

/// <summary>
/// Converts fetched web-page HTML into Markdown for the URL clipper, with
/// fallbacks for Next.js (__NEXT_DATA__) and raw-HTML extraction.
/// </summary>
internal static class WebClipHtmlConverter
{
    /// <summary>
    /// Converts article HTML to Markdown, handling code blocks, math formulas, images and figures.
    /// </summary>
    public static string ConvertHtmlToMarkdown(string html)
    {
        // --- Math: GFG uses <gfg-tex> for LaTeX ---
        // Block formulas: <blockquote><p><gfg-tex>...</gfg-tex></p></blockquote>
        html = Regex.Replace(html,
            @"<blockquote[^>]*>\s*<p[^>]*>\s*<gfg-tex>(.*?)</gfg-tex>\s*</p>\s*</blockquote>",
            m => $"\n\n$$\n{m.Groups[1].Value.Trim()}\n$$\n\n",
            RegexOptions.IgnoreCase | RegexOptions.Singleline);
        // Inline formulas
        html = Regex.Replace(html, @"<gfg-tex>(.*?)</gfg-tex>",
            m => $"${m.Groups[1].Value.Trim()}$",
            RegexOptions.IgnoreCase | RegexOptions.Singleline);

        // --- Code blocks: must run before inline <code> ---
        // <pre><code class="language-X">
        html = Regex.Replace(html,
            @"<pre[^>]*><code[^>]*class=""[^""]*language-(\w+)[^""]*""[^>]*>(.*?)</code></pre>",
            m =>
            {
                var lang = m.Groups[1].Value.Trim();
                var code = System.Net.WebUtility.HtmlDecode(StripTags(m.Groups[2].Value));
                return $"\n\n```{lang}\n{code}\n```\n\n";
            },
            RegexOptions.IgnoreCase | RegexOptions.Singleline);
        // <pre><code> without language
        html = Regex.Replace(html, @"<pre[^>]*><code[^>]*>(.*?)</code></pre>",
            m =>
            {
                var code = System.Net.WebUtility.HtmlDecode(StripTags(m.Groups[1].Value));
                return $"\n\n```\n{code}\n```\n\n";
            },
            RegexOptions.IgnoreCase | RegexOptions.Singleline);
        // <pre> without nested <code>
        html = Regex.Replace(html, @"<pre[^>]*>(.*?)</pre>",
            m =>
            {
                var code = System.Net.WebUtility.HtmlDecode(StripTags(m.Groups[1].Value));
                return $"\n\n```\n{code}\n```\n\n";
            },
            RegexOptions.IgnoreCase | RegexOptions.Singleline);
        // Inline <code>
        html = Regex.Replace(html, @"<code[^>]*>(.*?)</code>",
            m => $"`{StripTags(m.Groups[1].Value).Trim()}`",
            RegexOptions.IgnoreCase | RegexOptions.Singleline);

        // --- Figures (images with captions) ---
        html = Regex.Replace(html, @"<figure[^>]*>(.*?)</figure>",
            m =>
            {
                var inner = m.Groups[1].Value;
                var imgSrc = ExtractImgSrc(inner);
                if (string.IsNullOrEmpty(imgSrc)) return "";
                var alt = Regex.Match(inner, @"\balt=""([^""]*)""", RegexOptions.IgnoreCase).Groups[1].Value.Trim();
                var captionMatch = Regex.Match(inner, @"<figcaption[^>]*>(.*?)</figcaption>",
                    RegexOptions.IgnoreCase | RegexOptions.Singleline);
                var caption = captionMatch.Success ? StripTags(captionMatch.Groups[1].Value).Trim() : "";
                var sb = $"\n\n![{alt}]({imgSrc})\n\n";
                if (!string.IsNullOrEmpty(caption)) sb += $"*{caption}*\n\n";
                return sb;
            },
            RegexOptions.IgnoreCase | RegexOptions.Singleline);

        // --- Headings ---
        for (int level = 6; level >= 1; level--)
        {
            var hashes = new string('#', level);
            html = Regex.Replace(html, $@"<h{level}[^>]*>(.*?)</h{level}>",
                m => $"\n\n{hashes} {StripTags(m.Groups[1].Value).Trim()}\n\n",
                RegexOptions.IgnoreCase | RegexOptions.Singleline);
        }

        // --- Inline formatting ---
        html = Regex.Replace(html, @"<(strong|b)[^>]*>(.*?)</\1>",
            m => $"**{StripTags(m.Groups[2].Value).Trim()}**",
            RegexOptions.IgnoreCase | RegexOptions.Singleline);
        html = Regex.Replace(html, @"<(em|i)[^>]*>(.*?)</\1>",
            m => $"_{StripTags(m.Groups[2].Value).Trim()}_",
            RegexOptions.IgnoreCase | RegexOptions.Singleline);

        // --- Remaining images (not inside figures) ---
        html = Regex.Replace(html, @"<img[^>]*/?>",
            m =>
            {
                var src = ExtractImgSrc(m.Value);
                if (string.IsNullOrEmpty(src)) return "";
                var alt = Regex.Match(m.Value, @"\balt=""([^""]*)""", RegexOptions.IgnoreCase).Groups[1].Value.Trim();
                return $"\n\n![{alt}]({src})\n\n";
            },
            RegexOptions.IgnoreCase);

        // --- Links ---
        html = Regex.Replace(html, @"<a[^>]*href=""([^""]*)""[^>]*>(.*?)</a>",
            m => $"[{StripTags(m.Groups[2].Value).Trim()}]({m.Groups[1].Value})",
            RegexOptions.IgnoreCase | RegexOptions.Singleline);

        // --- Blockquotes ---
        html = Regex.Replace(html, @"<blockquote[^>]*>(.*?)</blockquote>",
            m => string.Join("\n", StripTags(m.Groups[1].Value).Trim().Split('\n').Select(l => $"> {l}")),
            RegexOptions.IgnoreCase | RegexOptions.Singleline);

        // --- Lists ---
        html = Regex.Replace(html, @"<li[^>]*>(.*?)</li>",
            m => $"\n- {StripTags(m.Groups[1].Value).Trim()}",
            RegexOptions.IgnoreCase | RegexOptions.Singleline);
        html = Regex.Replace(html, @"<(ul|ol)[^>]*>", "\n", RegexOptions.IgnoreCase);
        html = Regex.Replace(html, @"</(ul|ol)>", "\n", RegexOptions.IgnoreCase);

        // --- Block structure ---
        html = Regex.Replace(html, @"<p[^>]*>", "\n\n", RegexOptions.IgnoreCase);
        html = Regex.Replace(html, @"</p>", "\n\n", RegexOptions.IgnoreCase);
        html = Regex.Replace(html, @"<br\s*/?>", "\n", RegexOptions.IgnoreCase);
        html = Regex.Replace(html, @"<hr\s*/?>", "\n\n---\n\n", RegexOptions.IgnoreCase);
        // Divs and other block containers → line break so adjacent text doesn't merge
        html = Regex.Replace(html, @"<(div|section|article|header|footer|main|aside)[^>]*>", "\n", RegexOptions.IgnoreCase);
        html = Regex.Replace(html, @"</(div|section|article|header|footer|main|aside)>", "\n", RegexOptions.IgnoreCase);

        // Strip remaining tags
        html = StripTags(html);

        // Decode HTML entities
        html = System.Net.WebUtility.HtmlDecode(html);

        // Normalize whitespace
        html = Regex.Replace(html, @"\n{3,}", "\n\n");

        return html.Trim();
    }

    public static string ExtractImgSrc(string imgTag)
    {
        // Prefer data-src (lazy-loaded), fall back to src; skip data: URIs
        foreach (var attr in new[] { "data-src", "data-lazy-src", "src" })
        {
            var m = Regex.Match(imgTag, $@"\b{attr}=""([^""]*)""\s*", RegexOptions.IgnoreCase);
            if (m.Success)
            {
                var src = m.Groups[1].Value.Trim();
                if (!string.IsNullOrEmpty(src) && !src.StartsWith("data:", StringComparison.OrdinalIgnoreCase))
                    return src;
            }
        }
        return "";
    }

    public static string StripTags(string html)
        => Regex.Replace(html, @"<[^>]+>", "");

    public static string ExtractTitleFallback(string html)
    {
        var m = Regex.Match(html, @"<title[^>]*>(.*?)</title>", RegexOptions.IgnoreCase | RegexOptions.Singleline);
        if (m.Success)
        {
            var raw = m.Groups[1].Value.Trim();
            return Regex.Replace(raw, @"&[a-zA-Z]+;|&#\d+;", " ").Trim();
        }
        return "Clipped Article";
    }

    public static string ExtractAndConvertFallback(string html)
    {
        // Try <article>, <main>, then <body>
        foreach (var tag in new[] { "article", "main", "body" })
        {
            var m = Regex.Match(html, $@"<{tag}[^>]*>(.*?)</{tag}>", RegexOptions.IgnoreCase | RegexOptions.Singleline);
            if (m.Success) { html = m.Groups[1].Value; break; }
        }

        // Strip boilerplate block elements
        foreach (var tag in new[] { "nav", "footer", "aside", "header", "form", "dialog", "menu" })
            html = Regex.Replace(html, $@"<{tag}[^>]*>.*?</{tag}>", " ", RegexOptions.IgnoreCase | RegexOptions.Singleline);

        // Strip ad/sidebar/social divs by class/id keyword
        html = Regex.Replace(
            html,
            @"<(div|section|span|ul|ol|table)[^>]*(id|class)=""[^""]*\b(ad|ads|banner|sidebar|cookie|popup|promo|related|newsletter|subscribe|social|share|widget|comment|recommendation)[^""]*""[^>]*>.*?</\1>",
            " ", RegexOptions.IgnoreCase | RegexOptions.Singleline);

        // Strip script/style blocks
        html = Regex.Replace(html, @"<(script|style|noscript)[^>]*>.*?</\1>", "", RegexOptions.IgnoreCase | RegexOptions.Singleline);

        return ConvertHtmlToMarkdown(html);
    }

    /// <summary>
    /// Tries to extract article content from Next.js __NEXT_DATA__ JSON embedded in the page.
    /// Returns (title, htmlContent) if found, or (null, null) if not a Next.js page or content not located.
    /// </summary>
    public static (string? title, string? content) ExtractFromNextData(string html)
    {
        var scriptMatch = Regex.Match(html,
            @"<script\s+id=""__NEXT_DATA__""[^>]*>(.*?)</script>",
            RegexOptions.Singleline | RegexOptions.IgnoreCase);
        if (!scriptMatch.Success) return (null, null);

        try
        {
            using var doc = System.Text.Json.JsonDocument.Parse(scriptMatch.Groups[1].Value);
            var root = doc.RootElement;

            if (!root.TryGetProperty("props", out var props) ||
                !props.TryGetProperty("pageProps", out var pageProps))
                return (null, null);

            // GeeksForGeeks
            if (pageProps.TryGetProperty("postDataFromWriteApi", out var gfgPost))
            {
                var title = gfgPost.TryGetProperty("post_title", out var t) ? t.GetString() : null;
                var content = gfgPost.TryGetProperty("post_content", out var c) ? c.GetString() : null;
                if (!string.IsNullOrWhiteSpace(content))
                    return (title, content);
            }

            // Generic Next.js: try common content field names at pageProps level
            foreach (var key in new[] { "content", "body", "articleBody", "postContent", "htmlContent" })
            {
                if (pageProps.TryGetProperty(key, out var el) &&
                    el.ValueKind == System.Text.Json.JsonValueKind.String)
                {
                    var str = el.GetString();
                    if (!string.IsNullOrWhiteSpace(str) && str.Length > 200)
                        return (null, str);
                }
            }
        }
        catch { /* malformed JSON — fall through */ }

        return (null, null);
    }

    public static string SanitizeFileName(string name)
    {
        var invalid = Path.GetInvalidFileNameChars();
        var sanitized = string.Concat(name.Select(c => invalid.Contains(c) ? '_' : c));
        return sanitized.Length > 100 ? sanitized[..100] : sanitized;
    }
}
