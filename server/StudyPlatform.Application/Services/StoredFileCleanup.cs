using Microsoft.Extensions.Logging;

namespace StudyPlatform.Application.Services;

/// <summary>
/// Removes stored files once the rows that named them are gone.
///
/// <para>Always after the commit: deleting first left a course or document whose files were gone when the
/// save then failed, and every viewer showed "file not found". After the commit the worst case is an
/// orphaned file, logged here — never a live row pointing at nothing.</para>
/// </summary>
public interface IStoredFileCleanup
{
    /// <summary>Best-effort: one failure is logged and the rest still go. Empty URLs are skipped.</summary>
    Task DeleteAsync(IEnumerable<string?> blobUrls, CancellationToken cancellationToken = default);
}

/// <inheritdoc cref="IStoredFileCleanup"/>
public sealed class StoredFileCleanup : IStoredFileCleanup
{
    private readonly IBlobStorageService _blobStorage;
    private readonly ILogger<StoredFileCleanup> _logger;

    public StoredFileCleanup(IBlobStorageService blobStorage, ILogger<StoredFileCleanup> logger)
    {
        _blobStorage = blobStorage;
        _logger = logger;
    }

    public async Task DeleteAsync(IEnumerable<string?> blobUrls, CancellationToken cancellationToken = default)
    {
        foreach (var url in blobUrls.Where(u => !string.IsNullOrWhiteSpace(u)).Distinct())
        {
            try
            {
                await _blobStorage.DeleteAsync(url!, cancellationToken);
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                _logger.LogWarning(ex, "Could not delete stored file {BlobUrl}; it is now orphaned", url);
            }
        }
    }
}
