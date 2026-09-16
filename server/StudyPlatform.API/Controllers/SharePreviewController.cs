using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using StudyPlatform.Application.Services;
using StudyPlatform.Application.Share.Preview;
using StudyPlatform.Application.Share.Queries;

namespace StudyPlatform.API.Controllers;

/// <summary>
/// Serves the share page itself — not JSON — so that a link pasted into Slack, X, LinkedIn,
/// WhatsApp or WeChat unfurls with the share's own title, summary snippet and contents instead of
/// the landing page's generic card.
///
/// The share page is a client-rendered route: a crawler never runs the JavaScript that calls
/// /api/share/{token}, so the per-share metadata has to already be in the HTML. CloudFront routes
/// /share/* here (see deploy.sh); everything else still comes straight from the S3 bucket.
/// </summary>
[ApiController]
[AllowAnonymous]
[Route("share")]
[ApiExplorerSettings(IgnoreApi = true)]
public class SharePreviewController : ControllerBase
{
    private readonly IMediator _mediator;
    private readonly IAppShellProvider _shell;
    private readonly ISharePreviewFactory _previews;
    private readonly ISharePreviewHtmlRenderer _renderer;
    private readonly IConfiguration _configuration;

    public SharePreviewController(
        IMediator mediator,
        IAppShellProvider shell,
        ISharePreviewFactory previews,
        ISharePreviewHtmlRenderer renderer,
        IConfiguration configuration)
    {
        _mediator = mediator;
        _shell = shell;
        _previews = previews;
        _renderer = renderer;
        _configuration = configuration;
    }

    [HttpGet("{token}")]
    [Produces("text/html")]
    public async Task<IActionResult> GetSharePage(string token, CancellationToken cancellationToken = default)
    {
        var origin = ResolveWebOrigin();
        var result = await _mediator.Send(new GetSharePreviewQuery(token, origin), cancellationToken);
        var preview = result.IsSuccess && result.Data is not null
            ? result.Data
            : _previews.CreateUnavailable(token, origin);

        var shell = await _shell.GetShellHtmlAsync(cancellationToken);
        var html = shell is null
            ? _renderer.RenderStandalone(preview)
            : _renderer.Render(shell, preview);

        // Always 200, never 404: the CDN in front of this rewrites 403/404 to the SPA shell, and
        // an expired link is a page the app itself renders ("This share link has expired") rather
        // than an error. The status code a crawler sees does not change what it can show.
        Response.Headers["Cache-Control"] = result.IsSuccess
            ? "public, max-age=300"
            : "no-store";
        // Belt to robots.txt's braces — see the same note in SharePreviewHtmlRenderer.
        Response.Headers["X-Robots-Tag"] = "googlebot: noindex, nofollow";

        return Content(html, "text/html; charset=utf-8");
    }

    /// <summary>
    /// The public origin of the web app, which is what a share URL is built from. Behind CloudFront
    /// the Host header is the origin's, not the visitor's, so configuration is the source of truth
    /// and the request is only the local-development fallback.
    /// </summary>
    private string ResolveWebOrigin()
    {
        var configured = _configuration["Web:PublicOrigin"];
        return string.IsNullOrWhiteSpace(configured)
            ? $"{Request.Scheme}://{Request.Host}"
            : configured.TrimEnd('/');
    }
}
