namespace StudyPlatform.Application.Services;

/// <summary>One card to export. Srs values are null for cards the user hasn't reviewed yet.</summary>
public record AnkiExportCard(
    Guid FlashcardId,
    string Front,
    string Back,
    IReadOnlyList<string> Tags,
    int? SrsState,          // FSRS state 0-3
    int? IntervalDays,      // last scheduled interval
    int? Reps,
    int? Lapses,
    DateTime? Due);

public interface IAnkiExportService
{
    /// <summary>Builds a .apkg (Anki package) with one Basic-model deck, carrying scheduling state over.</summary>
    byte[] BuildPackage(string deckName, IReadOnlyList<AnkiExportCard> cards);
}
