namespace StudyPlatform.Application.Settings;

public class AppLimitsOptions
{
    public const string SectionName = "AppLimits";

    /// <summary>
    /// Maximum number of documents a user can upload. -1 means unlimited.
    /// </summary>
    public int DocumentUploadLimit { get; set; } = -1;

    /// <summary>
    /// Maximum number of audio files a user can upload. -1 means unlimited.
    /// </summary>
    public int AudioUploadLimit { get; set; } = -1;

    /// <summary>
    /// Maximum number of video files a user can upload. -1 means unlimited.
    /// </summary>
    public int VideoUploadLimit { get; set; } = -1;
}
