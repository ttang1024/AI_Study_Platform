using System.Security.Cryptography;
using System.Text;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using StudyPlatform.Application.Services;
using StudyPlatform.Application.Settings;

namespace StudyPlatform.Infrastructure.Services;

public partial class AiService : IAiService
{
    private readonly HttpClient _httpClient;
    private readonly ILogger<AiService> _logger;
    private readonly IHttpContextAccessor _httpContextAccessor;
    private readonly IAppCache _cache;
    private readonly CacheOptions _cacheOptions;
    private readonly IAiUsageRecorder _usageRecorder;

    public AiService(
        HttpClient httpClient,
        ILogger<AiService> logger,
        IHttpContextAccessor httpContextAccessor,
        IAppCache cache,
        IOptions<CacheOptions> cacheOptions,
        IAiUsageRecorder usageRecorder)
    {
        _httpClient = httpClient;
        _logger = logger;
        _httpContextAccessor = httpContextAccessor;
        _cache = cache;
        _cacheOptions = cacheOptions.Value;
        _usageRecorder = usageRecorder;
    }

    // ── Credentials ───────────────────────────────────────────────────────
    // Background jobs have no HttpContext, so they push the caller's captured credentials into
    // AmbientAiCredentials before running. That takes precedence over the request headers.

    private AiCredentials Credentials =>
        AmbientAiCredentials.Value ?? CredentialsFromHeaders();

    private AiCredentials CredentialsFromHeaders()
    {
        var headers = _httpContextAccessor.HttpContext?.Request.Headers;

        var provider = headers?["X-AI-Provider"].FirstOrDefault();
        if (string.IsNullOrWhiteSpace(provider))
            throw new InvalidOperationException("No AI provider specified. Please configure a provider in Settings → AI Services.");

        var model = headers?["X-AI-Model"].FirstOrDefault();
        if (string.IsNullOrWhiteSpace(model))
            throw new InvalidOperationException("No AI model specified. Please configure a model in Settings → AI Services.");

        var key = headers?["X-AI-Key"].FirstOrDefault()?.Trim();
        if (string.IsNullOrWhiteSpace(key))
            throw new InvalidOperationException(
                $"No API key configured for provider '{provider.ToLowerInvariant()}'. Please add your API key in Settings → AI Services.");

        return new AiCredentials(provider.ToLowerInvariant(), model, key, CurrentUserId());
    }

    private Guid CurrentUserId()
    {
        var claim = _httpContextAccessor.HttpContext?.User?.FindFirst("sub")?.Value
                    ?? _httpContextAccessor.HttpContext?.User?.FindFirst(
                        System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
        return Guid.TryParse(claim, out var id) ? id : Guid.Empty;
    }

    private string ApiKey => Credentials.ApiKey;
    private string Model => Credentials.Model;
    private string Provider => Credentials.Provider;

    // ── Gemini-only URLs (used for file/inline-data methods) ─────────────

    private string AiBaseUrl => $"https://generativelanguage.googleapis.com/v1beta/models/{Model}:generateContent";
    private string AiStreamUrl => $"https://generativelanguage.googleapis.com/v1beta/models/{Model}:streamGenerateContent";

    // ── Provider-aware URL builders ───────────────────────────────────────

    private string GetNonStreamUrl() => Provider switch
    {
        "openai" => "https://api.openai.com/v1/chat/completions",
        "deepseek" => "https://api.deepseek.com/v1/chat/completions",
        "kimi" => "https://api.moonshot.cn/v1/chat/completions",
        "doubao" => "https://ark.volcengine.com/api/v3/chat/completions",
        "claude" => "https://api.anthropic.com/v1/messages",
        "grok" => "https://api.x.ai/v1/chat/completions",
        "qwen" => "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions",
        "wenxin" => "https://qianfan.baidubce.com/v2/chat/completions",
        _ => $"{AiBaseUrl}?key={ApiKey}",
    };

    private string GetStreamUrl() => Provider switch
    {
        "openai" => "https://api.openai.com/v1/chat/completions",
        "deepseek" => "https://api.deepseek.com/v1/chat/completions",
        "kimi" => "https://api.moonshot.cn/v1/chat/completions",
        "doubao" => "https://ark.volcengine.com/api/v3/chat/completions",
        "claude" => "https://api.anthropic.com/v1/messages",
        "grok" => "https://api.x.ai/v1/chat/completions",
        "qwen" => "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions",
        "wenxin" => "https://qianfan.baidubce.com/v2/chat/completions",
        _ => $"{AiStreamUrl}?alt=sse&key={ApiKey}",
    };

    // ── File-based methods — always use Gemini (inline base64 data) ───────

    public async Task<string> GenerateMindMapAsync(byte[] fileData, string mimeType, CancellationToken cancellationToken = default)
    {
        var result = await CacheGeneratedResultAsync(
            "mindmap:file",
            HashBytes(fileData, mimeType, AiPrompts.MindMap),
            ct => CallAiWithFileAsync(fileData, mimeType, AiPrompts.MindMap, ct, cleanJson: false),
            cancellationToken);
        return AiResponseParsing.CleanTextResponse(result);
    }

    public Task<string> GenerateQuizAsync(byte[] fileData, string mimeType, string difficulty = "medium", CancellationToken cancellationToken = default)
    {
        var prompt = AiPrompts.QuizForDifficulty(difficulty);
        return CacheGeneratedResultAsync(
            "quiz:file",
            HashBytes(fileData, mimeType, prompt),
            ct => CallAiWithFileAsync(fileData, mimeType, prompt, ct),
            cancellationToken);
    }

    public Task<string> GenerateAdaptiveQuizAsync(byte[] fileData, string mimeType, QuizPlan plan, CancellationToken cancellationToken = default)
    {
        var prompt = AiPrompts.AdaptiveQuiz(plan.Difficulty, plan.FocusTopics);

        // The focus topics are part of the prompt, so they are part of the hash — a learner whose weak
        // spots have moved on gets a fresh quiz rather than the cached one aimed at yesterday's gaps.
        return CacheGeneratedResultAsync(
            "quiz:adaptive:file",
            HashBytes(fileData, mimeType, prompt),
            ct => CallAiWithFileAsync(fileData, mimeType, prompt, ct),
            cancellationToken);
    }

    public Task<string> GenerateAdaptiveQuizAsync(string textContent, QuizPlan plan, CancellationToken cancellationToken = default)
    {
        var prompt = $"{AiPrompts.AdaptiveQuiz(plan.Difficulty, plan.FocusTopics)}\n\nSource material:\n{AiResponseParsing.TruncateContent(textContent)}";
        return CacheGeneratedResultAsync(
            "quiz:adaptive:text",
            HashText(prompt),
            ct => SendTextAsync(null, [("user", prompt)], 0.7, 8192, cleanJson: true, ct),
            cancellationToken);
    }

    public Task<string> GenerateFlashcardsAsync(byte[] fileData, string mimeType, CancellationToken cancellationToken = default)
        => CacheGeneratedResultAsync(
            "flashcards:file:v2",
            HashBytes(fileData, mimeType, AiPrompts.Flashcards),
            ct => CallAiWithFileAsync(fileData, mimeType, AiPrompts.Flashcards, ct),
            cancellationToken);

    public Task<string> GenerateGlossaryAsync(byte[] fileData, string mimeType, CancellationToken cancellationToken = default)
        => CacheGeneratedResultAsync(
            "glossary:file",
            HashBytes(fileData, mimeType, AiPrompts.Glossary),
            ct => CallAiWithFileAsync(fileData, mimeType, AiPrompts.Glossary, ct),
            cancellationToken);

    public async Task<string> ExtractTextFromFileAsync(byte[] fileData, string mimeType, CancellationToken cancellationToken = default)
    {
        var result = await CacheGeneratedResultAsync(
            "extract-text:file",
            HashBytes(fileData, mimeType, AiPrompts.ExtractText),
            ct => CallAiWithFileAsync(fileData, mimeType, AiPrompts.ExtractText, ct, cleanJson: false),
            cancellationToken);
        return AiResponseParsing.CleanTextResponse(result);
    }

    // ── Text-based methods — provider-agnostic ────────────────────────────

    public async Task<string> GenerateMindMapAsync(string textContent, CancellationToken cancellationToken = default)
    {
        var prompt = $"{AiPrompts.MindMap}\n\nSource material:\n{AiResponseParsing.TruncateContent(textContent)}";
        var result = await CacheGeneratedResultAsync(
            "mindmap:text",
            HashText(prompt),
            ct => SendTextAsync(null, [("user", prompt)], 0.7, 8192, cleanJson: false, ct),
            cancellationToken);
        return AiResponseParsing.CleanTextResponse(result);
    }

    public Task<string> GenerateQuizAsync(string textContent, string difficulty = "medium", CancellationToken cancellationToken = default)
    {
        var prompt = $"{AiPrompts.QuizForDifficulty(difficulty)}\n\nSource material:\n{AiResponseParsing.TruncateContent(textContent)}";
        return CacheGeneratedResultAsync(
            "quiz:text",
            HashText(prompt),
            ct => SendTextAsync(null, [("user", prompt)], 0.7, 8192, cleanJson: true, ct),
            cancellationToken);
    }

    public Task<string> GenerateFlashcardsAsync(string textContent, CancellationToken cancellationToken = default)
    {
        var prompt = $"{AiPrompts.Flashcards}\n\nSource material:\n{AiResponseParsing.TruncateContent(textContent)}";
        return CacheGeneratedResultAsync(
            "flashcards:text:v2",
            HashText(prompt),
            ct => SendTextAsync(null, [("user", prompt)], 0.7, 8192, cleanJson: true, ct),
            cancellationToken);
    }

    public Task<string> GenerateGlossaryAsync(string textContent, CancellationToken cancellationToken = default)
    {
        var prompt = $"{AiPrompts.Glossary}\n\nSource material:\n{AiResponseParsing.TruncateContent(textContent)}";
        return CacheGeneratedResultAsync(
            "glossary:text",
            HashText(prompt),
            ct => SendTextAsync(null, [("user", prompt)], 0.7, 8192, cleanJson: true, ct),
            cancellationToken);
    }

    // ── YouTube-based methods — provider-agnostic ─────────────────────────

    public async Task<string> GenerateMindMapFromYouTubeAsync(string transcriptText, CancellationToken cancellationToken = default)
    {
        var prompt = $"{AiPrompts.YouTubeMindMap}\n\nSource material:\n{AiResponseParsing.TruncateContent(transcriptText)}";
        var result = await CacheGeneratedResultAsync(
            "mindmap:youtube",
            HashText(prompt),
            ct => SendTextAsync(null, [("user", prompt)], 0.3, 2048, cleanJson: false, ct),
            cancellationToken);
        return AiResponseParsing.CleanTextResponse(result);
    }

    public Task<string> GenerateQuizFromYouTubeAsync(string transcriptText, string difficulty = "medium", CancellationToken cancellationToken = default)
    {
        var prompt = $"{AiPrompts.YouTubeQuizForDifficulty(difficulty)}\n\nSource material:\n{AiResponseParsing.TruncateContent(transcriptText)}";
        return CacheGeneratedResultAsync(
            "quiz:youtube",
            HashText(prompt),
            ct => SendTextAsync(null, [("user", prompt)], 0.7, 8192, cleanJson: true, ct),
            cancellationToken);
    }

    public Task<string> GenerateFlashcardsFromYouTubeAsync(string transcriptText, CancellationToken cancellationToken = default)
    {
        var prompt = $"{AiPrompts.YouTubeFlashcards}\n\nSource material:\n{AiResponseParsing.TruncateContent(transcriptText)}";
        return CacheGeneratedResultAsync(
            "flashcards:youtube:v2",
            HashText(prompt),
            ct => SendTextAsync(null, [("user", prompt)], 0.7, 8192, cleanJson: true, ct),
            cancellationToken);
    }

    // ── Chat methods — provider-agnostic ─────────────────────────────────

    public Task<string> ChatWithYouTubeAsync(string transcriptText, IEnumerable<(string role, string content)> history, string message, CancellationToken cancellationToken = default)
    {
        var system = string.IsNullOrWhiteSpace(transcriptText)
            ? AiPrompts.YouTubeTutorInstruction
            : $"{AiPrompts.YouTubeTutorInstruction}\n\n[Source context]\n{AiResponseParsing.TruncateContent(transcriptText)}";

        var messages = history.Append(("user", message));
        return SendTextAsync(system, messages, 0.7, 8192, cleanJson: false, cancellationToken);
    }

    public Task<string> GeneralChatAsync(IEnumerable<(string role, string content)> history, string message, CancellationToken cancellationToken = default)
    {
        var messages = history.Append(("user", message));
        return SendTextAsync(AiPrompts.GeneralTutorInstruction, messages, 0.7, 8192, cleanJson: false, cancellationToken);
    }

    public Task<string> TestConnectionAsync(CancellationToken cancellationToken = default)
        => SendTextAsync(null, [("user", "Reply with exactly one word: OK")], 0, 16, cleanJson: false, cancellationToken);

    private Task<string> CacheGeneratedResultAsync(
        string category,
        string inputHash,
        Func<CancellationToken, Task<string>> factory,
        CancellationToken cancellationToken)
    {
        var cacheKey = $"ai:{Provider}:{Model}:{category}:{inputHash}";
        return _cache.GetOrCreateAsync(
            cacheKey,
            factory,
            TimeSpan.FromSeconds(_cacheOptions.GeneratedResultSeconds),
            cancellationToken);
    }

    private static string HashText(string text)
        => Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(text))).ToLowerInvariant();

    private static string HashBytes(byte[] bytes, string mimeType, string prompt)
    {
        using var sha = SHA256.Create();
        sha.TransformBlock(bytes, 0, bytes.Length, null, 0);

        var suffix = Encoding.UTF8.GetBytes($"{mimeType}:{prompt}");
        sha.TransformFinalBlock(suffix, 0, suffix.Length);

        return Convert.ToHexString(sha.Hash!).ToLowerInvariant();
    }

    public Task<string> GenerateFlashcardBackAsync(string frontText, CancellationToken cancellationToken = default)
    {
        var prompt = $"Generate a concise, accurate answer/back side for this flashcard front: \"{frontText}\". Return only the answer text, no extra commentary.";
        return CacheGeneratedResultAsync(
            "flashcard-back:text",
            HashText(prompt),
            ct => SendTextAsync(null, [("user", prompt)], 0.5, 512, cleanJson: false, ct),
            cancellationToken);
    }

    public Task<string> SuggestConceptLinksAsync(string documentContent, string entityType, Guid entityId, string existingTerms, CancellationToken cancellationToken = default)
    {
        var prompt = $@"Analyze the supplied study material and suggest concept links to related entities.
Do not use meta phrases such as ""this document"", ""the document"", ""this video"", ""the video"", ""the transcript"", ""the source material"", ""the content"", or similar wording in generated titles or labels.
Existing terms/concepts available: {existingTerms}
Entity type: {entityType}, Entity ID: {entityId}

Source material:
{AiResponseParsing.TruncateContent(documentContent, 2000)}

Return a JSON array of suggested links only, no markdown, no code blocks:
[{{""targetType"":""document""|""note""|""flashcard""|""glossary"",""targetTitle"":""..."",""label"":""relates to""|""defines""|""expands on""|""contradicts""}}]";
        return CacheGeneratedResultAsync(
            "concept-links:text",
            HashText(prompt),
            ct => SendTextAsync(null, [("user", prompt)], 0.5, 2048, cleanJson: true, ct),
            cancellationToken);
    }

    public Task<string> GenerateAudioOverviewScriptAsync(string courseName, string materialsDigest, CancellationToken cancellationToken = default)
    {
        var prompt = $@"Write a lively two-host podcast dialogue that gives an engaging audio overview of the course ""{courseName}"".
Host A (curious, asks sharp questions) and Host B (expert, explains clearly with concrete examples).
Cover the most important concepts across the materials, connect them, and close with 2-3 key takeaways.
Keep it conversational — short turns, natural interjections, no lists read aloud. Target 8-14 minutes of speech (roughly 1200-2000 words).

Course materials digest:
{AiResponseParsing.TruncateContent(materialsDigest, 12000)}

Return ONLY a JSON array of dialogue turns, no markdown, no code blocks:
[{{""speaker"":""A""|""B"",""text"":""...""}}]";
        return CacheGeneratedResultAsync(
            "audio-overview:text",
            HashText(prompt),
            ct => SendTextAsync(null, [("user", prompt)], 0.8, 8192, cleanJson: true, ct),
            cancellationToken);
    }

    public Task<string> GradeHandwrittenWorkAsync(
        IReadOnlyList<(byte[] data, string mimeType)> pages,
        string? problemStatement,
        CancellationToken cancellationToken = default)
    {
        if (pages.Count == 0)
            throw new InvalidOperationException("At least one image of the work is required.");

        var prompt = AiPrompts.GradeHandwrittenWork(problemStatement);

        // Temperature is low: grading should be reproducible. A learner who re-submits the same photo
        // and gets a different verdict has no reason to trust either one.
        return CacheGeneratedResultAsync(
            "grade-handwriting",
            HashPages(pages, prompt),
            ct => SendMultimodalTextAsync(
                systemPrompt: null,
                history: [],
                userMessage: prompt,
                attachments: pages,
                temperature: 0.2,
                maxTokens: 4096,
                cleanJson: true,
                cancellationToken: ct),
            cancellationToken);
    }

    private static string HashPages(IReadOnlyList<(byte[] data, string mimeType)> pages, string prompt)
    {
        using var sha = SHA256.Create();
        foreach (var (data, mimeType) in pages)
        {
            sha.TransformBlock(data, 0, data.Length, null, 0);
            var meta = Encoding.UTF8.GetBytes(mimeType);
            sha.TransformBlock(meta, 0, meta.Length, null, 0);
        }

        var suffix = Encoding.UTF8.GetBytes(prompt);
        sha.TransformFinalBlock(suffix, 0, suffix.Length);

        return Convert.ToHexString(sha.Hash!).ToLowerInvariant();
    }

    public Task<string> ChatAsync(string documentContent, string userMessage, IEnumerable<(string role, string content)> history, CancellationToken cancellationToken = default)
    {
        // The document goes in the system block and the history stays as real turns, rather than all
        // three being flattened into one user message. The system block is then byte-identical across
        // a conversation, which is what lets the provider's prompt cache hit on every turn but the first.
        var system = AiPrompts.BuildDocumentChatSystem(AiResponseParsing.TruncateContent(documentContent, 3000));
        return SendTextAsync(system, history.Append(("user", userMessage)), 0.7, 8192, cleanJson: false, cancellationToken);
    }

}
