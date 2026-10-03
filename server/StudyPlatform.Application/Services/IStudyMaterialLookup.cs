using StudyPlatform.Application.Documents.DTOs;

namespace StudyPlatform.Application.Services;

/// <summary>
/// Lists a user's documents and videos as one <see cref="PendingMaterialDto"/> feed, course
/// annotation included.
///
/// <para>Every "what can I still generate from?" screen — pending flashcards, pending quizzes,
/// quizzes generated but not yet taken — asks the same question of the same two tables and differs
/// only in which ids it wants. Keeping the join and the projection here is what stops those screens
/// disagreeing about a material's shape.</para>
/// </summary>
public interface IStudyMaterialLookup
{
    /// <summary>Materials the user owns whose ids are <em>not</em> in the covered sets.</summary>
    Task<IEnumerable<PendingMaterialDto>> ListUncoveredAsync(
        Guid userId,
        IEnumerable<Guid> coveredDocumentIds,
        IEnumerable<Guid> coveredVideoIds,
        CancellationToken cancellationToken = default);

    /// <summary>Materials the user owns whose ids are in the given sets.</summary>
    Task<IEnumerable<PendingMaterialDto>> ListSelectedAsync(
        Guid userId,
        IReadOnlySet<Guid> documentIds,
        IReadOnlySet<Guid> videoIds,
        CancellationToken cancellationToken = default);
}
