namespace StudyPlatform.Application.Flashcards.DTOs;

public record CreateFlashcardRequest(string Front, string Back, Guid? DocumentId = null, string CardType = "basic");

public record BulkDeleteFlashcardsRequest(IEnumerable<Guid> FlashcardIds);

public record FlashcardCoverageDto(
    IEnumerable<Guid> DocumentIds,
    IEnumerable<Guid> YouTubeVideoIds);

/// <summary>Rating: 1=Again, 2=Hard, 3=Good, 4=Easy</summary>
public record ReviewFlashcardRequest(int Rating);

/// <summary>Partial update — only non-null fields are applied.</summary>
public record ClassifyFlashcardRequest(
    string? Front = null,
    string? Back = null,
    string? Difficulty = null,
    string? Chapter = null,
    IEnumerable<string>? Tags = null);

public record ReviewFlashcardResponse(
    int ScheduledDays,
    double Retrievability,
    StudyPlatform.Application.Documents.DTOs.FlashcardSrsDto Srs);
