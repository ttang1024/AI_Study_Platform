namespace StudyPlatform.Domain.Entities;

public class GlossaryTerm
{
    public Guid GlossaryTermId { get; set; }
    public Guid? DocumentId { get; set; }
    public Guid? VideoId { get; set; }
    public Guid UserId { get; set; }
    public string Term { get; set; } = string.Empty;
    public string Definition { get; set; } = string.Empty;

    /// <summary>
    /// JSON <c>SourceAnchor</c> recording where in the source this term was defined. Null when the
    /// supporting quote could not be located.
    /// </summary>
    public string? SourceAnchorJson { get; set; }

    /// <summary>
    /// The document's ContentVersion at the time this was generated. Lower than the document's
    /// current version means the source has since changed and this is stale. Defaults to 1 so rows
    /// written before versioning existed read as current rather than as universally stale.
    /// </summary>
    public int SourceVersion { get; set; } = 1;

    public DateTime CreatedAt { get; set; }

    public Document? Document { get; set; }
    public Video? Video { get; set; }
}
