using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using StudyPlatform.Application.Services;

namespace StudyPlatform.Infrastructure.Services;

/// <summary>
/// Fetches index.html from the deployed web origin and caches it.
///
/// The asset filenames in the shell are content-hashed and change on every web deploy, so the
/// shell is read at runtime rather than baked into this image — the API and the frontend deploy
/// independently. Two cache entries back that up: a short one that makes the fetch rare, and a
/// long "last known good" one so a blip at the web origin does not take share pages down with it.
/// </summary>
public class WebAppShellProvider : IAppShellProvider
{
    private const string FreshKey = "app-shell:index";
    private const string LastGoodKey = "app-shell:index:last-good";
    private static readonly TimeSpan FreshFor = TimeSpan.FromMinutes(5);
    private static readonly TimeSpan LastGoodFor = TimeSpan.FromHours(24);

    private readonly HttpClient _httpClient;
    private readonly IConfiguration _configuration;
    private readonly IAppCache _cache;
    private readonly ILogger<WebAppShellProvider> _logger;

    public WebAppShellProvider(
        HttpClient httpClient,
        IConfiguration configuration,
        IAppCache cache,
        ILogger<WebAppShellProvider> logger)
    {
        _httpClient = httpClient;
        _configuration = configuration;
        _cache = cache;
        _logger = logger;
    }

    public async Task<string?> GetShellHtmlAsync(CancellationToken cancellationToken = default)
    {
        var origin = _configuration["Web:PublicOrigin"];
        if (string.IsNullOrWhiteSpace(origin))
            return null;

        var cached = await _cache.GetAsync<string>(FreshKey, cancellationToken);
        if (!string.IsNullOrEmpty(cached))
            return cached;

        var url = $"{origin.TrimEnd('/')}/index.html";
        try
        {
            var html = await _httpClient.GetStringAsync(url, cancellationToken);

            // A CDN error page is still a 200 with a body; only something that looks like the app
            // shell is worth caching or serving.
            if (!string.IsNullOrWhiteSpace(html) && html.Contains("</head>", StringComparison.OrdinalIgnoreCase))
            {
                await _cache.SetAsync(FreshKey, html, FreshFor, cancellationToken);
                await _cache.SetAsync(LastGoodKey, html, LastGoodFor, cancellationToken);
                return html;
            }

            _logger.LogWarning("App shell fetched from {Url} does not look like index.html", url);
        }
        catch (Exception ex) when (ex is not OperationCanceledException || !cancellationToken.IsCancellationRequested)
        {
            _logger.LogWarning(ex, "Failed to fetch the app shell from {Url}", url);
        }

        return await _cache.GetAsync<string>(LastGoodKey, cancellationToken);
    }
}
