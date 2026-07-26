namespace StudyPlatform.Application.Services;

public interface IAiService
{
    // Document-based (file bytes)
    Task<string> GenerateMindMapAsync(byte[] fileData, string mimeType, CancellationToken cancellationToken = default);
    Task<string> GenerateMindMapAsync(string textContent, CancellationToken cancellationToken = default);
    Task<string> GenerateQuizAsync(byte[] fileData, string mimeType, string difficulty = "medium", CancellationToken cancellationToken = default);
    Task<string> GenerateQuizAsync(string textContent, string difficulty = "medium", CancellationToken cancellationToken = default);

    /// <summary>Quiz weighted towards the concepts the learner keeps getting wrong. See <see cref="QuizPlan"/>.</summary>
    Task<string> GenerateAdaptiveQuizAsync(byte[] fileData, string mimeType, QuizPlan plan, CancellationToken cancellationToken = default);
    Task<string> GenerateAdaptiveQuizAsync(string textContent, QuizPlan plan, CancellationToken cancellationToken = default);
    Task<string> GenerateFlashcardsAsync(byte[] fileData, string mimeType, CancellationToken cancellationToken = default);
    Task<string> GenerateFlashcardsAsync(string textContent, CancellationToken cancellationToken = default);
    Task<string> GenerateGlossaryAsync(byte[] fileData, string mimeType, CancellationToken cancellationToken = default);
    Task<string> GenerateGlossaryAsync(string textContent, CancellationToken cancellationToken = default);
    /// <summary>OCR-style transcription of a binary file (scanned PDF, image) into plain text.</summary>
    Task<string> ExtractTextFromFileAsync(byte[] fileData, string mimeType, CancellationToken cancellationToken = default);
    Task<string> ChatAsync(string documentContent, string userMessage, IEnumerable<(string role, string content)> history, CancellationToken cancellationToken = default);

    // YouTube-based (transcript text)
    Task<string> GenerateMindMapFromYouTubeAsync(string transcriptText, CancellationToken cancellationToken = default);
    Task<string> GenerateQuizFromYouTubeAsync(string transcriptText, string difficulty = "medium", CancellationToken cancellationToken = default);
    Task<string> GenerateFlashcardsFromYouTubeAsync(string transcriptText, CancellationToken cancellationToken = default);
    Task<string> ChatWithYouTubeAsync(string transcriptText, IEnumerable<(string role, string content)> history, string message, CancellationToken cancellationToken = default);

    // General chat (no document context)
    Task<string> GeneralChatAsync(IEnumerable<(string role, string content)> history, string message, CancellationToken cancellationToken = default);

    // Provider connection test
    Task<string> TestConnectionAsync(CancellationToken cancellationToken = default);

    // Phase 2 additions
    Task<string> GenerateWorkedProblemsAsync(string content, string difficulty, int count, CancellationToken cancellationToken = default);
    Task<string> EvaluateProblemAttemptAsync(string problem, string solution, string userAnswer, CancellationToken cancellationToken = default);
    Task<string> AnswerQuestionAsync(string documentContent, string question, CancellationToken cancellationToken = default);
    Task<string> EvaluateExplanationAsync(string topic, string reference, string explanation, CancellationToken cancellationToken = default);

    /// <summary>
    /// Translates generated study material into another language, preserving Markdown and LaTeX.
    /// </summary>
    Task<string> TranslateAsync(
        string text, string targetLanguage, CancellationToken cancellationToken = default);

    /// <summary>
    /// Marks a piece of writing against a rubric. Returns the JSON described by AiPrompts.GradeEssay:
    /// an overall comment, quoted strengths and improvements, and a score per criterion.
    /// </summary>
    Task<string> GradeEssayAsync(
        string criteriaJson, string? promptText, string essayText, CancellationToken cancellationToken = default);

    // Phase 3 additions
    Task<string> GenerateFlashcardBackAsync(string frontText, CancellationToken cancellationToken = default);
    Task<string> SuggestConceptLinksAsync(string documentContent, string entityType, Guid entityId, string existingTerms, CancellationToken cancellationToken = default);

    // Audio overview (NotebookLM-style two-host dialogue)
    Task<string> GenerateAudioOverviewScriptAsync(string courseName, string materialsDigest, CancellationToken cancellationToken = default);

    /// <summary>
    /// Grades a photographed handwritten solution, step by step. Returns the JSON described by
    /// AiPrompts.GradeHandwrittenWork. Pages are graded together as one continuous solution.
    /// </summary>
    Task<string> GradeHandwrittenWorkAsync(
        IReadOnlyList<(byte[] data, string mimeType)> pages,
        string? problemStatement,
        CancellationToken cancellationToken = default);

    // Streaming variants
    IAsyncEnumerable<string> StreamSummaryAsync(byte[] fileData, string mimeType, CancellationToken cancellationToken = default);
    IAsyncEnumerable<string> StreamSummaryAsync(string textContent, CancellationToken cancellationToken = default);
    IAsyncEnumerable<string> StreamTimelineSummaryAsync(string timedTranscript, string mediaType, CancellationToken cancellationToken = default);
    IAsyncEnumerable<string> StreamSummaryFromYouTubeAsync(string transcriptText, CancellationToken cancellationToken = default);
    IAsyncEnumerable<string> StreamMindMapAsync(byte[] fileData, string mimeType, CancellationToken cancellationToken = default);
    IAsyncEnumerable<string> StreamMindMapAsync(string textContent, CancellationToken cancellationToken = default);
    IAsyncEnumerable<string> StreamMindMapFromYouTubeAsync(string transcriptText, CancellationToken cancellationToken = default);
    IAsyncEnumerable<string> StreamChatAsync(string documentContent, string userMessage, IEnumerable<(string role, string content)> history, CancellationToken cancellationToken = default);
    IAsyncEnumerable<string> StreamChatAsync(string documentContent, string userMessage, IEnumerable<(string role, string content)> history, IReadOnlyList<(byte[] data, string mimeType)> attachments, CancellationToken cancellationToken = default);
    IAsyncEnumerable<string> StreamChatWithYouTubeAsync(string transcriptText, IEnumerable<(string role, string content)> history, string message, CancellationToken cancellationToken = default);
    IAsyncEnumerable<string> StreamChatWithYouTubeAsync(string transcriptText, IEnumerable<(string role, string content)> history, string message, IReadOnlyList<(byte[] data, string mimeType)> attachments, CancellationToken cancellationToken = default);
    IAsyncEnumerable<string> StreamGeneralChatAsync(IEnumerable<(string role, string content)> history, string message, CancellationToken cancellationToken = default);
    IAsyncEnumerable<string> StreamGeneralChatAsync(IEnumerable<(string role, string content)> history, string message, IReadOnlyList<(byte[] data, string mimeType)> attachments, CancellationToken cancellationToken = default);
}
