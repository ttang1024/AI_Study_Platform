using System.Net.Http.Headers;
using System.Runtime.CompilerServices;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using StudyPlatform.Application.Services;
using StudyPlatform.Application.Settings;

namespace StudyPlatform.Infrastructure.Services;

public partial class AiService : IAiService
{
    private readonly HttpClient _httpClient;
    private readonly IConfiguration _configuration;
    private readonly ILogger<AiService> _logger;
    private readonly IHttpContextAccessor _httpContextAccessor;
    private readonly IAppCache _cache;
    private readonly CacheOptions _cacheOptions;

    public AiService(
        HttpClient httpClient,
        IConfiguration configuration,
        ILogger<AiService> logger,
        IHttpContextAccessor httpContextAccessor,
        IAppCache cache,
        IOptions<CacheOptions> cacheOptions)
    {
        _httpClient = httpClient;
        _configuration = configuration;
        _logger = logger;
        _httpContextAccessor = httpContextAccessor;
        _cache = cache;
        _cacheOptions = cacheOptions.Value;
    }

    // ── Request-scoped settings ───────────────────────────────────────────

    private string ApiKey
    {
        get
        {
            var headerKey = _httpContextAccessor.HttpContext?.Request.Headers["X-AI-Key"].FirstOrDefault()?.Trim();
            if (!string.IsNullOrWhiteSpace(headerKey))
                return headerKey;

            throw new InvalidOperationException(
                $"No API key configured for provider '{Provider}'. Please add your API key in Settings → AI Services.");
        }
    }

    private string Model
    {
        get
        {
            var headerModel = _httpContextAccessor.HttpContext?.Request.Headers["X-AI-Model"].FirstOrDefault();
            if (!string.IsNullOrWhiteSpace(headerModel))
                return headerModel;
            throw new InvalidOperationException("No AI model specified. Please configure a model in Settings → AI Services.");
        }
    }

    private string Provider
    {
        get
        {
            var h = _httpContextAccessor.HttpContext?.Request.Headers["X-AI-Provider"].FirstOrDefault();
            if (string.IsNullOrWhiteSpace(h))
                throw new InvalidOperationException("No AI provider specified. Please configure a provider in Settings → AI Services.");
            return h.ToLowerInvariant();
        }
    }

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

    public Task<string> ChatAsync(string documentContent, string userMessage, IEnumerable<(string role, string content)> history, CancellationToken cancellationToken = default)
    {
        var prompt = AiPrompts.BuildDocumentChatPrompt(AiResponseParsing.TruncateContent(documentContent, 3000), string.Join("\n", history.Select(h => $"{h.role.ToUpper()}: {h.content}")), userMessage);
        return SendTextAsync(null, [("user", prompt)], 0.7, 8192, cleanJson: false, cancellationToken);
    }

}
