namespace StudyPlatform.Application.Services;

public interface IBlobStorageService
{
    Task<string> UploadAsync(Stream fileStream, string fileName, string contentType, CancellationToken cancellationToken = default);
    Task DeleteAsync(string blobUrl, CancellationToken cancellationToken = default);
    Task<Stream> DownloadAsync(string blobUrl, CancellationToken cancellationToken = default);
    Task<string> GetSasUrlAsync(string blobUrl, int expiryMinutes = 60, CancellationToken cancellationToken = default);

    /// <summary>
    /// A short-lived URL a browser can load media from directly (so the bytes never pass through the
    /// API), served with <paramref name="contentType"/> whatever the object was stored with — the stored
    /// type is the uploader's claim, the one passed here is derived by the server.
    /// </summary>
    Task<string> GetMediaUrlAsync(string blobUrl, string contentType, int expiryMinutes = 60, CancellationToken cancellationToken = default);
}
