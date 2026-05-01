namespace StudyPlatform.Application.Common;

public static class AiInlineData
{
    public static bool IsSupported(string mimeType) =>
        mimeType is "application/pdf"
            or "image/png" or "image/jpeg" or "image/gif" or "image/webp"
            or "image/heic" or "image/heif"
            or "audio/mpeg" or "audio/mp3" or "audio/mp4" or "audio/x-m4a"
            or "audio/wav" or "audio/x-wav" or "audio/ogg" or "audio/aac"
            or "audio/flac" or "audio/webm";
}
