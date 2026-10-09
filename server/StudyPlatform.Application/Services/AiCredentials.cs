namespace StudyPlatform.Application.Services;

/// <summary>The provider/model/key triple an AI call runs under, plus the user it is billed to.</summary>
public sealed record AiCredentials(string Provider, string Model, string ApiKey, Guid UserId);
