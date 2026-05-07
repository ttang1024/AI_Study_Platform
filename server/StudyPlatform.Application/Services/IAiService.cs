namespace StudyPlatform.Application.Services;

public interface IAiService
{
    // Document-based (file bytes)
    Task<string> GenerateMindMapAsync(byte[] fileData, string mimeType, CancellationToken cancellationToken = default);
    Task<string> GenerateMindMapAsync(string textContent, CancellationToken cancellationToken = default);
    Task<string> GenerateQuizAsync(byte[] fileData, string mimeType, CancellationToken cancellationToken = default);
    Task<string> GenerateQuizAsync(string textContent, CancellationToken cancellationToken = default);
    Task<string> GenerateFlashcardsAsync(byte[] fileData, string mimeType, CancellationToken cancellationToken = default);
    Task<string> GenerateFlashcardsAsync(string textContent, CancellationToken cancellationToken = default);
    Task<string> GenerateGlossaryAsync(byte[] fileData, string mimeType, CancellationToken cancellationToken = default);
    Task<string> GenerateGlossaryAsync(string textContent, CancellationToken cancellationToken = default);
    Task<string> ChatAsync(string documentContent, string userMessage, IEnumerable<(string role, string content)> history, CancellationToken cancellationToken = default);

    // YouTube-based (transcript text)
    Task<string> GenerateMindMapFromYouTubeAsync(string transcriptText, CancellationToken cancellationToken = default);
    Task<string> GenerateQuizFromYouTubeAsync(string transcriptText, CancellationToken cancellationToken = default);
    Task<string> GenerateFlashcardsFromYouTubeAsync(string transcriptText, CancellationToken cancellationToken = default);
    Task<string> ChatWithYouTubeAsync(string transcriptText, IEnumerable<(string role, string content)> history, string message, CancellationToken cancellationToken = default);

    // General chat (no document context)
    Task<string> GeneralChatAsync(IEnumerable<(string role, string content)> history, string message, CancellationToken cancellationToken = default);

    // Provider connection test
    Task<string> TestConnectionAsync(CancellationToken cancellationToken = default);

    // OCR
    Task<string> ExtractTextFromImageAsync(byte[] imageData, string mimeType, CancellationToken cancellationToken = default);

    // Phase 2 additions
    Task<string> GenerateWorkedProblemsAsync(string content, string difficulty, int count, CancellationToken cancellationToken = default);
    Task<string> EvaluateProblemAttemptAsync(string problem, string solution, string userAnswer, CancellationToken cancellationToken = default);
    Task<string> AnswerQuestionAsync(string documentContent, string question, CancellationToken cancellationToken = default);

    // Phase 3 additions
    Task<string> GenerateFlashcardBackAsync(string frontText, CancellationToken cancellationToken = default);
    Task<string> SuggestConceptLinksAsync(string documentContent, string entityType, Guid entityId, string existingTerms, CancellationToken cancellationToken = default);

    // Streaming variants
    IAsyncEnumerable<string> StreamSummaryAsync(byte[] fileData, string mimeType, CancellationToken cancellationToken = default);
    IAsyncEnumerable<string> StreamSummaryAsync(string textContent, CancellationToken cancellationToken = default);
    IAsyncEnumerable<string> StreamTimelineSummaryAsync(string timedTranscript, string mediaType, CancellationToken cancellationToken = default);
    IAsyncEnumerable<string> StreamSummaryFromYouTubeAsync(string transcriptText, CancellationToken cancellationToken = default);
    IAsyncEnumerable<string> StreamMindMapAsync(byte[] fileData, string mimeType, CancellationToken cancellationToken = default);
    IAsyncEnumerable<string> StreamMindMapAsync(string textContent, CancellationToken cancellationToken = default);
    IAsyncEnumerable<string> StreamMindMapFromYouTubeAsync(string transcriptText, CancellationToken cancellationToken = default);
    IAsyncEnumerable<string> StreamChatAsync(string documentContent, string userMessage, IEnumerable<(string role, string content)> history, CancellationToken cancellationToken = default);
    IAsyncEnumerable<string> StreamChatWithYouTubeAsync(string transcriptText, IEnumerable<(string role, string content)> history, string message, CancellationToken cancellationToken = default);
    IAsyncEnumerable<string> StreamGeneralChatAsync(IEnumerable<(string role, string content)> history, string message, CancellationToken cancellationToken = default);
}
