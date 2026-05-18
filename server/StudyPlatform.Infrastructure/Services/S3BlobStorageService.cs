using Amazon.S3;
using Amazon.S3.Model;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using StudyPlatform.Application.Services;
using System.Net;

namespace StudyPlatform.Infrastructure.Services;

public class S3BlobStorageService : IBlobStorageService
{
    private readonly IAmazonS3 _s3Client;
    private readonly IAmazonS3 _presignClient;
    private readonly string _bucketName;
    private readonly ILogger<S3BlobStorageService> _logger;
    private readonly SemaphoreSlim _bucketLock = new(1, 1);
    private volatile bool _bucketReady;

    public S3BlobStorageService(IConfiguration configuration, ILogger<S3BlobStorageService> logger)
    {
        _logger = logger;
        _bucketName = CleanConfigValue(configuration["S3:BucketName"])
            ?? throw new InvalidOperationException("S3 bucket name is not configured.");

        var region = CleanConfigValue(configuration["AWS:Region"]) ?? CleanConfigValue(configuration["AWS_REGION"]);
        var serviceUrl = CleanConfigValue(configuration["S3:ServiceUrl"])
            ?? CleanConfigValue(configuration["S3:Endpoint"]);
        var publicServiceUrl = CleanConfigValue(configuration["S3:PublicServiceUrl"]);

        var config = new AmazonS3Config
        {
            ForcePathStyle = configuration.GetValue("S3:ForcePathStyle", !string.IsNullOrWhiteSpace(serviceUrl))
        };

        if (!string.IsNullOrWhiteSpace(serviceUrl))
            config.ServiceURL = serviceUrl;
        else if (!string.IsNullOrWhiteSpace(region))
            config.RegionEndpoint = Amazon.RegionEndpoint.GetBySystemName(region);

        var accessKey = CleanConfigValue(configuration["S3:AccessKey"]);
        var secretKey = CleanConfigValue(configuration["S3:SecretKey"]);
        _s3Client = !string.IsNullOrWhiteSpace(accessKey) && !string.IsNullOrWhiteSpace(secretKey)
            ? new AmazonS3Client(accessKey, secretKey, config)
            : new AmazonS3Client(config);

        _presignClient = _s3Client;
        if (!string.IsNullOrWhiteSpace(publicServiceUrl))
        {
            var presignConfig = new AmazonS3Config
            {
                ServiceURL = publicServiceUrl,
                ForcePathStyle = configuration.GetValue("S3:ForcePathStyle", true)
            };

            _presignClient = !string.IsNullOrWhiteSpace(accessKey) && !string.IsNullOrWhiteSpace(secretKey)
                ? new AmazonS3Client(accessKey, secretKey, presignConfig)
                : new AmazonS3Client(presignConfig);
        }
    }

    private static string? CleanConfigValue(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
            return null;

        return value.Trim().Trim('"', '\'');
    }

    private string GetObjectKey(string blobUrl)
    {
        if (blobUrl.StartsWith("s3://", StringComparison.OrdinalIgnoreCase))
        {
            var uri = new Uri(blobUrl);
            return Uri.UnescapeDataString(uri.AbsolutePath.TrimStart('/'));
        }

        var parsed = new Uri(blobUrl);
        return Uri.UnescapeDataString(parsed.AbsolutePath.TrimStart('/'));
    }

    private async Task EnsureBucketExistsAsync(CancellationToken cancellationToken)
    {
        if (_bucketReady)
            return;

        await _bucketLock.WaitAsync(cancellationToken);
        try
        {
            if (_bucketReady)
                return;

            try
            {
                await _s3Client.GetBucketLocationAsync(new GetBucketLocationRequest
                {
                    BucketName = _bucketName
                }, cancellationToken);
            }
            catch (AmazonS3Exception ex) when (ex.StatusCode == HttpStatusCode.NotFound || ex.ErrorCode == "NoSuchBucket")
            {
                await _s3Client.PutBucketAsync(new PutBucketRequest
                {
                    BucketName = _bucketName
                }, cancellationToken);
            }

            _bucketReady = true;
        }
        finally
        {
            _bucketLock.Release();
        }
    }

    public async Task<string> UploadAsync(Stream fileStream, string fileName, string contentType, CancellationToken cancellationToken = default)
    {
        await EnsureBucketExistsAsync(cancellationToken);

        var request = new PutObjectRequest
        {
            BucketName = _bucketName,
            Key = fileName,
            InputStream = fileStream,
            ContentType = contentType
        };

        await _s3Client.PutObjectAsync(request, cancellationToken);
        return $"s3://{_bucketName}/{Uri.EscapeDataString(fileName).Replace("%2F", "/", StringComparison.OrdinalIgnoreCase)}";
    }

    public async Task DeleteAsync(string blobUrl, CancellationToken cancellationToken = default)
    {
        try
        {
            await _s3Client.DeleteObjectAsync(_bucketName, GetObjectKey(blobUrl), cancellationToken);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to delete S3 object: {BlobUrl}", blobUrl);
        }
    }

    public async Task<Stream> DownloadAsync(string blobUrl, CancellationToken cancellationToken = default)
    {
        var response = await _s3Client.GetObjectAsync(_bucketName, GetObjectKey(blobUrl), cancellationToken);
        return response.ResponseStream;
    }

    public async Task<string> GetFileContentAsync(string blobUrl, CancellationToken cancellationToken = default)
    {
        try
        {
            await using var stream = await DownloadAsync(blobUrl, cancellationToken);
            using var reader = new StreamReader(stream);
            return await reader.ReadToEndAsync(cancellationToken);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to get file content from S3 object: {BlobUrl}", blobUrl);
            return string.Empty;
        }
    }

    public string GetSasUrl(string blobUrl, int expiryMinutes)
    {
        var request = new GetPreSignedUrlRequest
        {
            BucketName = _bucketName,
            Key = GetObjectKey(blobUrl),
            Verb = HttpVerb.GET,
            Expires = DateTime.UtcNow.AddMinutes(expiryMinutes)
        };

        return _presignClient.GetPreSignedURL(request);
    }

    public Task<string> GetSasUrlAsync(string blobUrl, int expiryMinutes = 60, CancellationToken cancellationToken = default)
    {
        return Task.FromResult(GetSasUrl(blobUrl, expiryMinutes));
    }
}
