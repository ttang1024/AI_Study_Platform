using System.Security.Cryptography;
using System.Text;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using StudyPlatform.Application.Common;
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
    private readonly TimeSpan _requestTimeout;

    public AiService(
        HttpClient httpClient,
        ILogger<AiService> logger,
        IHttpContextAccessor httpContextAccessor,
        IAppCache cache,
        IOptions<CacheOptions> cacheOptions,
        IAiUsageRecorder usageRecorder,
        IOptions<AiRequestOptions> requestOptions)
    {
        _requestTimeout = TimeSpan.FromSeconds(Math.Max(1, requestOptions.Value.NonStreamingTimeoutSeconds));
        _httpClient = httpClient;
        _logger = logger;
        _httpContextAccessor = httpContextAccessor;
        _cache = cache;
        _cacheOptions = cacheOptions.Value;
        _usageRecorder = usageRecorder;
    }

    // ── Credentials ───────────────────────────────────────────────────────

    private AiCredentials ReadCredentials()
    {
        var headers = _httpContextAccessor.HttpContext?.Request.Headers;

        var provider = headers?["X-AI-Provider"].FirstOrDefault();
        var model = headers?["X-AI-Model"].FirstOrDefault();
        var key = headers?["X-AI-Key"].FirstOrDefault()?.Trim();

        var hasOwnCredentials =
            !string.IsNullOrWhiteSpace(provider)
            && !string.IsNullOrWhiteSpace(model)
            && !string.IsNullOrWhiteSpace(key);

        if (hasOwnCredentials)
            return new AiCredentials(provider!.ToLowerInvariant(), model!, key!, CurrentUserId());

        if (string.IsNullOrWhiteSpace(provider))
            throw new UserFacingException("No AI provider specified. Please configure a provider in Settings → AI Services.");

        if (string.IsNullOrWhiteSpace(model))
            throw new UserFacingException("No AI model specified. Please configure a model in Settings → AI Services.");

        throw new UserFacingException(
            $"No API key configured for provider '{provider.ToLowerInvariant()}'. Please add your API key in Settings → AI Services.");
    }

    private Guid CurrentUserId()
    {
        var claim = _httpContextAccessor.HttpContext?.User?.FindFirst("sub")?.Value
                    ?? _httpContextAccessor.HttpContext?.User?.FindFirst(
                        System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
        return Guid.TryParse(claim, out var id) ? id : Guid.Empty;
    }

    private string ApiKey => ReadCredentials().ApiKey;
    private string Model => ReadCredentials().Model;
    private string Provider => ReadCredentials().Provider;

    // ── Provider endpoints ───────────────────────────────────────────────

    /// <summary>
    /// The chat endpoint per provider (OpenAI-compatible, plus Anthropic's messages API). The same URL
    /// serves streaming and non-streaming calls; the request body's <c>stream</c> flag picks. Any other
    /// provider value is Gemini, whose URL names the model and the method instead.
    /// </summary>
    private static readonly IReadOnlyDictionary<string, string> ChatEndpoints = new Dictionary<string, string>
    {
        ["openai"] = "https://api.openai.com/v1/chat/completions",
        ["deepseek"] = "https://api.deepseek.com/v1/chat/completions",
        ["kimi"] = "https://api.moonshot.cn/v1/chat/completions",
        ["doubao"] = "https://ark.volcengine.com/api/v3/chat/completions",
        ["claude"] = "https://api.anthropic.com/v1/messages",
        ["grok"] = "https://api.x.ai/v1/chat/completions",
        ["qwen"] = "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions",
        ["wenxin"] = "https://qianfan.baidubce.com/v2/chat/completions",
    };

    private const string GeminiModelsUrl = "https://generativelanguage.googleapis.com/v1beta/models/";

    private bool IsGemini => !ChatEndpoints.ContainsKey(Provider);

    // The model name comes from a client header, so it is escaped before it becomes part of a path.
    // The Gemini key travels in the x-goog-api-key header (BuildHttpRequest), never in the URL, where
    // it would land in proxy and HTTP-client logs.
    private string GetNonStreamUrl() => ChatEndpoints.TryGetValue(Provider, out var url)
        ? url
        : $"{GeminiModelsUrl}{Uri.EscapeDataString(Model)}:generateContent";

    private string GetStreamUrl() => ChatEndpoints.TryGetValue(Provider, out var url)
        ? url
        : $"{GeminiModelsUrl}{Uri.EscapeDataString(Model)}:streamGenerateContent?alt=sse";

    // ── File-based methods — always use Gemini (inline base64 data) ───────

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


    public Task<string> ChatAsync(string documentContent, string userMessage, IEnumerable<(string role, string content)> history, CancellationToken cancellationToken = default)
    {
        // The document goes in the system block and the history stays as real turns, rather than all
        // three being flattened into one user message. The system block is then byte-identical across
        // a conversation, which is what lets the provider's prompt cache hit on every turn but the first.
        var system = AiPrompts.BuildDocumentChatSystem(AiResponseParsing.TruncateContent(documentContent, 3000));
        return SendTextAsync(system, history.Append(("user", userMessage)), 0.7, 8192, cleanJson: false, cancellationToken);
    }

}
