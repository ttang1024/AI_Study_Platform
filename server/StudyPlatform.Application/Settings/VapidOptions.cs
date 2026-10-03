namespace StudyPlatform.Application.Settings;

/// <summary>
/// VAPID keys for Web Push. Generate a pair once (e.g. `npx web-push generate-vapid-keys`)
/// and set them via configuration/environment; push features stay disabled without them.
/// </summary>
public class VapidOptions
{
    public const string SectionName = "Vapid";

    public string PublicKey { get; set; } = string.Empty;
    public string PrivateKey { get; set; } = string.Empty;
    /// <summary>mailto: or https: contact URI included in pushes, per the VAPID spec.</summary>
    public string Subject { get; set; } = "mailto:admin@example.com";

    public bool IsConfigured => !string.IsNullOrWhiteSpace(PublicKey) && !string.IsNullOrWhiteSpace(PrivateKey);
}
