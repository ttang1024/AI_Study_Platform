namespace StudyPlatform.Application.Services;

/// <summary>
/// Supplies the built web app's index.html — the shell the SPA boots from — so a server-rendered
/// page can hand a crawler real metadata and still hand a browser the same application it would
/// have got from the CDN.
/// </summary>
public interface IAppShellProvider
{
    /// <returns>The shell HTML, or null when it cannot be obtained.</returns>
    Task<string?> GetShellHtmlAsync(CancellationToken cancellationToken = default);
}
