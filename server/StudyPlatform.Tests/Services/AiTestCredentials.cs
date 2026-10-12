using StudyPlatform.Application.Services;

namespace StudyPlatform.Tests.Services;

/// <summary>A credentials provider that always answers the given triple.</summary>
internal static class AiTestCredentials
{
    public static IAiCredentialsProvider Provider(string provider, string model, string apiKey, Guid? userId = null)
        => new Fixed(new AiCredentials(provider, model, apiKey, userId ?? Guid.NewGuid()));

    private sealed class Fixed(AiCredentials credentials) : IAiCredentialsProvider
    {
        public AiCredentials GetRequired() => credentials;
    }
}
