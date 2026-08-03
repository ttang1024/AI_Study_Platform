namespace StudyPlatform.Domain.Entities;

/// <summary>
/// Proof that a user reached mastery on a course, at the moment they reached it.
///
/// <para>Everything shown on the certificate is snapshotted rather than joined: the course name, the
/// holder's name, and the score are copied in at issue time. A certificate that re-read them would
/// silently change when the course is renamed and would break outright when it is deleted — and a
/// credential whose contents can shift after being shared is not a credential.</para>
/// </summary>
public class CourseCertificate
{
    public Guid CourseCertificateId { get; set; }
    public Guid UserId { get; set; }

    /// <summary>
    /// The course this was earned on. Nullable so deleting a course does not take the certificate
    /// with it — the snapshot below is what the certificate actually renders.
    /// </summary>
    public Guid? CourseId { get; set; }

    /// <summary>Course name as it stood at issue.</summary>
    public string CourseName { get; set; } = string.Empty;

    /// <summary>Holder's name as it stood at issue.</summary>
    public string RecipientName { get; set; } = string.Empty;

    /// <summary>The mastery score, 0-100, that qualified it.</summary>
    public double MasteryScore { get; set; }

    /// <summary>
    /// The unguessable slug in the public verification URL.
    ///
    /// <para>Long and random because that link is the whole verification mechanism — anyone holding
    /// it can confirm the certificate, and nobody without it should be able to enumerate one.</para>
    /// </summary>
    public string PublicToken { get; set; } = string.Empty;

    public DateTime IssuedAt { get; set; }

    /// <summary>
    /// Set when the holder withdraws the certificate. Kept rather than deleted so a link that was
    /// already shared resolves to "revoked" instead of "never existed" — the honest answer for
    /// anyone checking.
    /// </summary>
    public DateTime? RevokedAt { get; set; }

    public User User { get; set; } = null!;
}
