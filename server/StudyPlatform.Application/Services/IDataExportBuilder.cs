namespace StudyPlatform.Application.Services;

/// <summary>
/// Assembles everything the platform holds on one user into a single ZIP.
///
/// <para>Returns a stream rather than writing to storage itself so the caller owns where the archive
/// lands and how long it lives — the worker uploads it and stamps an expiry, and tests can read the
/// bytes without a blob backend.</para>
/// </summary>
public interface IDataExportBuilder
{
    /// <summary>
    /// Builds the archive. The returned stream is positioned at zero and owned by the caller.
    /// </summary>
    Task<Stream> BuildAsync(Guid userId, CancellationToken cancellationToken = default);
}
