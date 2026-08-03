namespace StudyPlatform.Application.Security.DTOs;

/// <summary>
/// Whether the second factor is on, and how much of the safety net is left.
/// <see cref="RecoveryCodesRemaining"/> is a count and never the codes themselves.
/// </summary>
public record TwoFactorStatusDto(
    bool Enabled,
    DateTime? EnabledAt,
    int RecoveryCodesRemaining);

/// <summary>
/// The one response that carries the shared secret. Returned only while enrolment is pending —
/// once the factor is enabled there is no read path that discloses it again.
/// </summary>
public record TwoFactorSetupDto(
    string Secret,
    string OtpAuthUri);

/// <summary>
/// Recovery codes in plaintext. Also shown exactly once: only BCrypt hashes are stored, so a user
/// who loses these has to regenerate rather than re-read them.
/// </summary>
public record TwoFactorEnabledDto(IReadOnlyList<string> RecoveryCodes);

public record EnableTwoFactorRequest(string Code);

public record DisableTwoFactorRequest(string Password);

public record RegenerateRecoveryCodesRequest(string Password);

/// <summary>Second leg of a two-step login. <c>Code</c> is either a TOTP code or a recovery code.</summary>
public record VerifyTwoFactorRequest(string ChallengeToken, string Code);

/// <summary>
/// A live sign-in, described for a human. The raw token value is never included — the point of the
/// list is to manage sessions without handing out the credentials that are those sessions.
/// </summary>
public record SessionDto(
    Guid SessionId,
    string? DeviceName,
    string? IpAddress,
    DateTime StartedAt,
    DateTime? LastUsedAt,
    DateTime ExpiresAt,
    bool IsCurrent);

public record DataExportDto(
    Guid DataExportRequestId,
    string Status,
    DateTime CreatedAt,
    DateTime? CompletedAt,
    long? SizeBytes,
    DateTime? ExpiresAt,
    string? ErrorMessage,
    bool IsDownloadable);

public record AuditEntryDto(
    Guid AuditLogEntryId,
    string Action,
    Guid? ActorUserId,
    Guid? SubjectUserId,
    string? TargetType,
    string? TargetId,
    string? MetadataJson,
    string? IpAddress,
    string? UserAgent,
    DateTime CreatedAt);

/// <summary>
/// Deleting an account needs the password and a typed confirmation. The password is what proves the
/// request; the typed phrase is what makes a misclick on an irreversible button unlikely.
/// </summary>
public record DeleteAccountRequest(string Password, string Confirmation);
