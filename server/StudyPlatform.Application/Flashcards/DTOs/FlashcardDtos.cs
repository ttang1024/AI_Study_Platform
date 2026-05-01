namespace StudyPlatform.Application.Flashcards.DTOs;

public record CreateFlashcardRequest(string Front, string Back, Guid? DocumentId = null);

public record BulkDeleteFlashcardsRequest(IEnumerable<Guid> FlashcardIds);

public record FlashcardCoverageDto(
    IEnumerable<Guid> DocumentIds,
    IEnumerable<Guid> YouTubeVideoIds);
