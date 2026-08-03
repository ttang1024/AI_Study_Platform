namespace StudyPlatform.Domain.Entities;

/// <summary>
/// One security-relevant thing that happened, and who did it.
///
/// <para>Append-only by convention: nothing in the application updates or deletes these rows, and
/// the admin read path is a query with no write counterpart. An audit trail an actor can edit
/// answers no question worth asking.</para>
///
/// <para><see cref="ActorUserId"/> and <see cref="SubjectUserId"/> are separate because the entries
/// that matter most are the ones where they differ — an admin reading another user's data. For
/// ordinary self-service actions they are the same value.</para>
/// </summary>
public class AuditLogEntry
{
    public Guid AuditLogEntryId { get; set; }

    /// <summary>Who performed the action. Null for unauthenticated attempts, e.g. a failed login.</summary>
    public Guid? ActorUserId { get; set; }

    /// <summary>Whose data was acted on. Equals <see cref="ActorUserId"/> for self-service actions.</summary>
    public Guid? SubjectUserId { get; set; }

    /// <summary>Stable dotted key, e.g. <c>auth.login.failed</c> or <c>admin.user.viewed</c>.</summary>
    public string Action { get; set; } = string.Empty;

    /// <summary>What kind of thing was acted on, e.g. <c>User</c>, <c>ApiKey</c>. Null for account-level events.</summary>
    public string? TargetType { get; set; }

    public string? TargetId { get; set; }

    /// <summary>
    /// JSON object of action-specific detail. Deliberately schemaless — every action carries
    /// different context, and a column per action would be a migration for every new event type.
    /// Must never contain secrets: this is the one table an admin is expected to read in full.
    /// </summary>
    public string? MetadataJson { get; set; }

    public string? IpAddress { get; set; }
    public string? UserAgent { get; set; }

    public DateTime CreatedAt { get; set; }
}
