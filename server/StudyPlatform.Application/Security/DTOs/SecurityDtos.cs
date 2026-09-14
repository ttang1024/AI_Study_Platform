namespace StudyPlatform.Application.Security.DTOs;

public record DataExportDto(
    Guid DataExportRequestId,
    string Status,
    DateTime CreatedAt,
    DateTime? CompletedAt,
    long? SizeBytes,
    DateTime? ExpiresAt,
    string? ErrorMessage,
    bool IsDownloadable);

/// <summary>
/// Deleting an account needs the password and a typed confirmation. The password is what proves the
/// request; the typed phrase is what makes a misclick on an irreversible button unlikely.
/// </summary>
public record DeleteAccountRequest(string Password, string Confirmation);
