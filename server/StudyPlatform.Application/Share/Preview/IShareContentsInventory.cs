using StudyPlatform.Domain.Entities;

namespace StudyPlatform.Application.Share.Preview;

/// <summary>
/// Describes what a share actually contains — "Summary, mind map, 24 flashcards, 10 quiz
/// questions". Its own collaborator because it changes when the stored JSON shapes change, which
/// has nothing to do with how a preview card is worded.
/// </summary>
public interface IShareContentsInventory
{
    /// <summary>
    /// A sentence-cased, comma-separated list of what the share holds. Empty when the share
    /// carries nothing listable.
    /// </summary>
    string Describe(ShareToken share);
}
