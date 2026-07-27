namespace StudyPlatform.Application.Services;

public interface IBlobStorageService
{
    Task<string> UploadAsync(Stream fileStream, string fileName, string contentType, CancellationToken cancellationToken = default);
    Task DeleteAsync(string blobUrl, CancellationToken cancellationToken = default);
    Task<Stream> DownloadAsync(string blobUrl, CancellationToken cancellationToken = default);
    Task<string> GetSasUrlAsync(string blobUrl, int expiryMinutes = 60, CancellationToken cancellationToken = default);
}
