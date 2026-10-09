using StudyPlatform.Domain.Interfaces;

namespace StudyPlatform.Domain.Entities;

public class GlossaryTerm : IUserOwned
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

    public DateTime CreatedAt { get; set; }

    public Document? Document { get; set; }
    public Video? Video { get; set; }
}
