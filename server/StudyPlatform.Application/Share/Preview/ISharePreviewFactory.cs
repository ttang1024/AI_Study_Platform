using StudyPlatform.Domain.Entities;

namespace StudyPlatform.Application.Share.Preview;

/// <summary>
/// Composes the link-preview card for a share link.
/// </summary>
public interface ISharePreviewFactory
{
    /// <param name="origin">Public origin of the web app, e.g. https://toto-study.com.</param>
    SharePreview Create(ShareToken share, string origin);

    /// <summary>
    /// The card for a token that no longer resolves. Says the link is gone without hinting at what
    /// it used to hold.
    /// </summary>
    SharePreview CreateUnavailable(string token, string origin);
}
