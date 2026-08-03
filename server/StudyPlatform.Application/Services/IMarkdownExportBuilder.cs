namespace StudyPlatform.Application.Services;

/// <summary>
/// Renders a course as a Markdown vault the user can open in Obsidian or any editor.
///
/// <para>Distinct from <see cref="IDataExportBuilder"/>: that produces a complete machine record of
/// an account, this produces something meant to be read and edited, and deliberately omits the
/// bookkeeping that would be noise in a notes app.</para>
/// </summary>
public interface IMarkdownExportBuilder
{
    /// <summary>
    /// Builds the archive, or null when the course does not exist or is not the user's — folded
    /// together so a caller cannot tell those two cases apart.
    /// </summary>
    Task<(Stream Content, string FileName)?> BuildAsync(
        Guid userId, Guid courseId, CancellationToken cancellationToken = default);
}
