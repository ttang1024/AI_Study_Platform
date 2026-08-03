namespace StudyPlatform.Application.Services;

/// <summary>
/// Records a security-relevant event. Fire-and-forget from the caller's point of view: a failure to
/// write the trail is logged and swallowed, never surfaced, because refusing a user's password
/// change because the audit table was unreachable trades a real capability for a paper one.
/// </summary>
public interface IAuditLogger
{
    Task LogAsync(
        string action,
        Guid? actorUserId = null,
        Guid? subjectUserId = null,
        string? targetType = null,
        string? targetId = null,
        object? metadata = null,
        CancellationToken cancellationToken = default);
}

/// <summary>
/// The action keys the platform writes. Constants rather than literals so the admin filter list and
/// the write sites cannot drift apart, and so renaming an event is a compile error rather than a
/// silently empty filter.
/// </summary>
public static class AuditActions
{
    public const string LoginSucceeded = "auth.login.succeeded";
    public const string LoginFailed = "auth.login.failed";
    public const string LogoutAll = "auth.logout.all";
    public const string PasswordChanged = "auth.password.changed";
    public const string PasswordReset = "auth.password.reset";

    public const string TwoFactorEnabled = "auth.2fa.enabled";
    public const string TwoFactorDisabled = "auth.2fa.disabled";
    public const string TwoFactorChallengeFailed = "auth.2fa.failed";
    public const string TwoFactorRecoveryUsed = "auth.2fa.recovery_used";
    public const string RecoveryCodesRegenerated = "auth.2fa.recovery_regenerated";

    public const string SessionRevoked = "auth.session.revoked";

    public const string DataExportRequested = "account.export.requested";
    public const string DataExportDownloaded = "account.export.downloaded";
    public const string AccountDeletionRequested = "account.deletion.requested";
    public const string AccountDeleted = "account.deleted";

    public const string ApiKeyCreated = "apikey.created";
    public const string ApiKeyRevoked = "apikey.revoked";
    public const string WebhookCreated = "webhook.created";
    public const string WebhookDeleted = "webhook.deleted";

    public const string AdminUserViewed = "admin.user.viewed";
    public const string AdminUserDeactivated = "admin.user.deactivated";
}
