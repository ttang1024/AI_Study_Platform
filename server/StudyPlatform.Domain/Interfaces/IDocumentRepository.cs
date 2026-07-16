using StudyPlatform.Domain.Entities;

namespace StudyPlatform.Domain.Interfaces;

/// <summary>
/// A Document row is one of three things to the user depending on its content type and whether it was
/// clipped from a URL: a plain document, a web article, or an audio/podcast episode. Counting them means
/// applying the same three-way split in several places, so it lives here once.
/// </summary>
public record MaterialCounts(int Documents, int Articles, int Audio)
{
    public static readonly MaterialCounts Empty = new(0, 0, 0);

    public int Total => Documents + Articles + Audio;
}

public interface IDocumentRepository : IRepository<Document>
{
    /// <summary>Whole-library material counts for a user, split by kind, in one grouped query.</summary>
    Task<MaterialCounts> GetMaterialCountsAsync(Guid userId, CancellationToken cancellationToken = default);

    /// <summary>
    /// Per-course material counts for a user, split by kind. One grouped query for the whole library —
    /// the alternative is a COUNT per course per kind, which is where the stats endpoint used to spend
    /// all of its time.
    /// </summary>
    Task<IReadOnlyDictionary<Guid, MaterialCounts>> GetMaterialCountsByCourseAsync(Guid userId, CancellationToken cancellationToken = default);

    /// <summary>
    /// Maps every one of a user's documents to the course it belongs to, without materialising the rows.
    /// Documents carry their full extracted text; a caller that only needs to attribute an artifact to a
    /// course should not drag that across the wire.
    /// </summary>
    Task<IReadOnlyDictionary<Guid, Guid>> GetDocumentCourseMapAsync(Guid userId, CancellationToken cancellationToken = default);

    Task<IEnumerable<Document>> GetByCourseIdAsync(Guid courseId, Guid userId, CancellationToken cancellationToken = default);
    Task<IEnumerable<Document>> GetByCourseIdAsync(Guid courseId, CancellationToken cancellationToken = default);
    Task<Document?> GetByIdWithDetailsAsync(Guid documentId, CancellationToken cancellationToken = default);
    Task<bool> BelongsToUserAsync(Guid documentId, Guid userId, CancellationToken cancellationToken = default);
    Task<IEnumerable<Document>> GetByUserIdAsync(Guid userId, DateTime date, CancellationToken cancellationToken = default);
    Task<(IEnumerable<Document> Items, int TotalCount)> GetAllByUserIdAsync(Guid userId, int page, int pageSize, Guid? courseId, CancellationToken cancellationToken = default);
    Task<Document?> GetByUserIdAndFileHashAsync(Guid userId, string fileHash, CancellationToken cancellationToken = default);
    Task<int> CountByUserIdAsync(Guid userId, CancellationToken cancellationToken = default);
    Task<IEnumerable<Document>> SearchByUserAsync(Guid userId, string query, int limit, CancellationToken cancellationToken = default);
}
