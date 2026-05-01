using System.Text;
using System.Text.RegularExpressions;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using SmartReader;
using StudyPlatform.API.Extensions;
using StudyPlatform.Application.Common;
using StudyPlatform.Application.Documents.Commands;
using StudyPlatform.Application.Documents.DTOs;
using StudyPlatform.Application.Documents.Queries;

namespace StudyPlatform.API.Controllers;

[ApiController]
[Route("api/documents")]
[Authorize]
[Produces("application/json")]
public class UserDocumentsController : ControllerBase
{
    private readonly IMediator _mediator;
    private readonly ILogger<UserDocumentsController> _logger;

    public UserDocumentsController(IMediator mediator, ILogger<UserDocumentsController> logger)
    {
        _mediator = mediator;
        _logger = logger;
    }

    /// <summary>
    /// Clip a web article URL and save it as a document
    /// </summary>
    [HttpPost("clip-url")]
    [ProducesResponseType(typeof(BaseResponse<DocumentDto>), 201)]
    [ProducesResponseType(typeof(BaseResponse), 400)]
    public async Task<IActionResult> ClipUrl(
        [FromBody] ClipUrlRequest request,
        [FromServices] IHttpClientFactory httpClientFactory,
        CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.Url))
            return BadRequest(BaseResponse<DocumentDto>.Fail("URL is required.", "URL_REQUIRED"));

        if (!Guid.TryParse(request.CourseId, out var courseId))
            return BadRequest(BaseResponse<DocumentDto>.Fail("A valid course must be selected.", "COURSE_REQUIRED"));

        string html;
        try
        {
            var client = httpClientFactory.CreateClient("WebClipper");
            using var response = await client.GetAsync(request.Url, cancellationToken);
            response.EnsureSuccessStatusCode();
            html = await response.Content.ReadAsStringAsync(cancellationToken);
        }
        catch (Exception ex)
        {
            return BadRequest(BaseResponse<DocumentDto>.Fail($"Failed to fetch URL: {ex.Message}", "URL_FETCH_FAILED"));
        }

        _logger.LogDebug("HTML fetched: length={Length}, preview={Preview}",
            html.Length, html.Length > 300 ? html[..300] : html);

        var reader = new Reader(request.Url, html)
        {
            ContinueIfNotReadable = true
        };
        var article = reader.GetArticle();

        _logger.LogDebug("SmartReader: IsReadable={IsReadable}, Title={Title}, ContentLength={ContentLength}",
            article.IsReadable, article.Title, article.Content?.Length ?? 0);

        string title, markdown;
        if (!string.IsNullOrWhiteSpace(article.Content))
        {
            // SmartReader successfully extracted clean article HTML
            title = !string.IsNullOrWhiteSpace(article.Title) ? article.Title : "Clipped Article";
            markdown = ConvertHtmlToMarkdown(article.Content);
        }
        else
        {
            // SmartReader couldn't extract content — try __NEXT_DATA__ JSON first (Next.js sites),
            // then fall back to regex extraction on the raw HTML.
            _logger.LogDebug("SmartReader returned empty content, trying __NEXT_DATA__ extraction");
            var (nextTitle, nextContent) = ExtractFromNextData(html);
            if (!string.IsNullOrWhiteSpace(nextContent))
            {
                _logger.LogDebug("__NEXT_DATA__ extraction succeeded, content length={Length}", nextContent.Length);
                title = nextTitle ?? (!string.IsNullOrWhiteSpace(article.Title) ? article.Title : ExtractTitleFallback(html));
                markdown = ConvertHtmlToMarkdown(nextContent);
            }
            else
            {
                _logger.LogDebug("__NEXT_DATA__ not found, falling back to regex extraction");
                title = !string.IsNullOrWhiteSpace(article.Title) ? article.Title : ExtractTitleFallback(html);
                markdown = ExtractAndConvertFallback(html);
            }
        }

        if (string.IsNullOrWhiteSpace(markdown))
            return BadRequest(BaseResponse<DocumentDto>.Fail("No readable content found at the provided URL.", "NO_CONTENT"));
        var fileName = SanitizeFileName(title) + ".md";
        var bytes = Encoding.UTF8.GetBytes(markdown);
        using var stream = new MemoryStream(bytes);

        var userId = User.GetUserId();
        var result = await _mediator.Send(new ClipUrlCommand(courseId, userId, fileName, stream, bytes.Length, "text/markdown", request.Url), cancellationToken);

        if (!result.IsSuccess)
            return BadRequest(BaseResponse<DocumentDto>.Fail(result.Message, result.ErrorCode));

        return StatusCode(201, BaseResponse<DocumentDto>.Ok(result.Data!, result.Message));
    }

    /// <summary>
    /// Extract text from an image via OCR and create a document
    /// </summary>
    [HttpPost("ocr")]
    [ProducesResponseType(typeof(BaseResponse<DocumentDto>), 201)]
    [ProducesResponseType(typeof(BaseResponse), 400)]
    public async Task<IActionResult> OcrImage(
        [FromForm] IFormFile imageFile,
        [FromForm] Guid? courseId,
        CancellationToken cancellationToken)
    {
        if (imageFile == null || imageFile.Length == 0)
            return BadRequest(BaseResponse<DocumentDto>.Fail("Image file is required.", "FILE_REQUIRED"));

        var allowedTypes = new[] { "image/png", "image/jpeg", "image/jpg", "image/webp" };
        if (!allowedTypes.Contains(imageFile.ContentType.ToLowerInvariant()))
            return BadRequest(BaseResponse<DocumentDto>.Fail("Unsupported image type. Use PNG, JPG, or WEBP.", "INVALID_TYPE"));

        using var ms = new MemoryStream();
        await imageFile.CopyToAsync(ms, cancellationToken);
        var imageBytes = ms.ToArray();

        var userId = User.GetUserId();
        var fileName = Path.GetFileNameWithoutExtension(imageFile.FileName);
        var result = await _mediator.Send(new OcrImageCommand(userId, courseId, imageBytes, imageFile.ContentType, fileName), cancellationToken);

        if (!result.IsSuccess)
            return BadRequest(BaseResponse<DocumentDto>.Fail(result.Message, result.ErrorCode));

        return StatusCode(201, BaseResponse<DocumentDto>.Ok(result.Data!, result.Message));
    }

    /// <summary>
    /// Converts article HTML to Markdown, handling code blocks, math formulas, images and figures.
    /// </summary>
    private static string ConvertHtmlToMarkdown(string html)
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

    private static string ExtractImgSrc(string imgTag)
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

    private static string StripTags(string html)
        => Regex.Replace(html, @"<[^>]+>", "");

    private static string ExtractTitleFallback(string html)
    {
        var m = Regex.Match(html, @"<title[^>]*>(.*?)</title>", RegexOptions.IgnoreCase | RegexOptions.Singleline);
        if (m.Success)
        {
            var raw = m.Groups[1].Value.Trim();
            return Regex.Replace(raw, @"&[a-zA-Z]+;|&#\d+;", " ").Trim();
        }
        return "Clipped Article";
    }

    private static string ExtractAndConvertFallback(string html)
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
    private static (string? title, string? content) ExtractFromNextData(string html)
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

    private static string SanitizeFileName(string name)
    {
        var invalid = Path.GetInvalidFileNameChars();
        var sanitized = string.Concat(name.Select(c => invalid.Contains(c) ? '_' : c));
        return sanitized.Length > 100 ? sanitized[..100] : sanitized;
    }

    /// <summary>
    /// Get all documents for the authenticated user with pagination
    /// </summary>
    [HttpGet]
    [ProducesResponseType(typeof(BaseResponse<PaginatedList<DocumentDto>>), 200)]
    public async Task<IActionResult> GetAllDocuments(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 50,
        [FromQuery] Guid? courseId = null)
    {
        var userId = User.GetUserId();
        var result = await _mediator.Send(new GetAllDocumentsQuery(userId, page, pageSize, courseId));
        return Ok(BaseResponse<PaginatedList<DocumentDto>>.Ok(result.Data!));
    }
}
