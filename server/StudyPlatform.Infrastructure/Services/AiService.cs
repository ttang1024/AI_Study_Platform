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

public class AiService : IAiService
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
            HashBytes(fileData, mimeType, Prompts.MindMap),
            ct => CallAiWithFileAsync(fileData, mimeType, Prompts.MindMap, ct, cleanJson: false),
            cancellationToken);
        return CleanTextResponse(result);
    }

    public Task<string> GenerateQuizAsync(byte[] fileData, string mimeType, string difficulty = "medium", CancellationToken cancellationToken = default)
    {
        var prompt = Prompts.QuizForDifficulty(difficulty);
        return CacheGeneratedResultAsync(
            "quiz:file",
            HashBytes(fileData, mimeType, prompt),
            ct => CallAiWithFileAsync(fileData, mimeType, prompt, ct),
            cancellationToken);
    }

    public Task<string> GenerateFlashcardsAsync(byte[] fileData, string mimeType, CancellationToken cancellationToken = default)
        => CacheGeneratedResultAsync(
            "flashcards:file:v2",
            HashBytes(fileData, mimeType, Prompts.Flashcards),
            ct => CallAiWithFileAsync(fileData, mimeType, Prompts.Flashcards, ct),
            cancellationToken);

    public Task<string> GenerateGlossaryAsync(byte[] fileData, string mimeType, CancellationToken cancellationToken = default)
        => CacheGeneratedResultAsync(
            "glossary:file",
            HashBytes(fileData, mimeType, Prompts.Glossary),
            ct => CallAiWithFileAsync(fileData, mimeType, Prompts.Glossary, ct),
            cancellationToken);

    // ── Text-based methods — provider-agnostic ────────────────────────────

    public async Task<string> GenerateMindMapAsync(string textContent, CancellationToken cancellationToken = default)
    {
        var prompt = $"{Prompts.MindMap}\n\nSource material:\n{TruncateContent(textContent)}";
        var result = await CacheGeneratedResultAsync(
            "mindmap:text",
            HashText(prompt),
            ct => SendTextAsync(null, [("user", prompt)], 0.7, 8192, cleanJson: false, ct),
            cancellationToken);
        return CleanTextResponse(result);
    }

    public Task<string> GenerateQuizAsync(string textContent, string difficulty = "medium", CancellationToken cancellationToken = default)
    {
        var prompt = $"{Prompts.QuizForDifficulty(difficulty)}\n\nSource material:\n{TruncateContent(textContent)}";
        return CacheGeneratedResultAsync(
            "quiz:text",
            HashText(prompt),
            ct => SendTextAsync(null, [("user", prompt)], 0.7, 8192, cleanJson: true, ct),
            cancellationToken);
    }

    public Task<string> GenerateFlashcardsAsync(string textContent, CancellationToken cancellationToken = default)
    {
        var prompt = $"{Prompts.Flashcards}\n\nSource material:\n{TruncateContent(textContent)}";
        return CacheGeneratedResultAsync(
            "flashcards:text:v2",
            HashText(prompt),
            ct => SendTextAsync(null, [("user", prompt)], 0.7, 8192, cleanJson: true, ct),
            cancellationToken);
    }

    public Task<string> GenerateGlossaryAsync(string textContent, CancellationToken cancellationToken = default)
    {
        var prompt = $"{Prompts.Glossary}\n\nSource material:\n{TruncateContent(textContent)}";
        return CacheGeneratedResultAsync(
            "glossary:text",
            HashText(prompt),
            ct => SendTextAsync(null, [("user", prompt)], 0.7, 8192, cleanJson: true, ct),
            cancellationToken);
    }

    // ── YouTube-based methods — provider-agnostic ─────────────────────────

    public async Task<string> GenerateMindMapFromYouTubeAsync(string transcriptText, CancellationToken cancellationToken = default)
    {
        var prompt = $"{Prompts.YouTubeMindMap}\n\nSource material:\n{TruncateContent(transcriptText)}";
        var result = await CacheGeneratedResultAsync(
            "mindmap:youtube",
            HashText(prompt),
            ct => SendTextAsync(null, [("user", prompt)], 0.3, 2048, cleanJson: false, ct),
            cancellationToken);
        return CleanTextResponse(result);
    }

    public Task<string> GenerateQuizFromYouTubeAsync(string transcriptText, string difficulty = "medium", CancellationToken cancellationToken = default)
    {
        var prompt = $"{Prompts.YouTubeQuizForDifficulty(difficulty)}\n\nSource material:\n{TruncateContent(transcriptText)}";
        return CacheGeneratedResultAsync(
            "quiz:youtube",
            HashText(prompt),
            ct => SendTextAsync(null, [("user", prompt)], 0.7, 8192, cleanJson: true, ct),
            cancellationToken);
    }

    public Task<string> GenerateFlashcardsFromYouTubeAsync(string transcriptText, CancellationToken cancellationToken = default)
    {
        var prompt = $"{Prompts.YouTubeFlashcards}\n\nSource material:\n{TruncateContent(transcriptText)}";
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
            ? Prompts.YouTubeTutorInstruction
            : $"{Prompts.YouTubeTutorInstruction}\n\n[Source context]\n{TruncateContent(transcriptText)}";

        var messages = history.Append(("user", message));
        return SendTextAsync(system, messages, 0.7, 8192, cleanJson: false, cancellationToken);
    }

    public Task<string> GeneralChatAsync(IEnumerable<(string role, string content)> history, string message, CancellationToken cancellationToken = default)
    {
        var messages = history.Append(("user", message));
        return SendTextAsync(Prompts.GeneralTutorInstruction, messages, 0.7, 8192, cleanJson: false, cancellationToken);
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
{TruncateContent(documentContent, 2000)}

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
        var prompt = BuildDocumentChatPrompt(TruncateContent(documentContent, 3000), string.Join("\n", history.Select(h => $"{h.role.ToUpper()}: {h.content}")), userMessage);
        return SendTextAsync(null, [("user", prompt)], 0.7, 8192, cleanJson: false, cancellationToken);
    }

    // ── Provider-agnostic core: non-streaming ─────────────────────────────

    private async Task<string> SendTextAsync(
        string? systemPrompt,
        IEnumerable<(string role, string content)> messages,
        double temperature,
        int maxTokens,
        bool cleanJson,
        CancellationToken cancellationToken)
    {
        using var request = BuildRequest(systemPrompt, messages, temperature, maxTokens, stream: false, GetNonStreamUrl());

        using var response = await _httpClient.SendAsync(request, cancellationToken);
        if (!response.IsSuccessStatusCode)
        {
            var err = await response.Content.ReadAsStringAsync(cancellationToken);
            _logger.LogError("{Provider} API error: {Status} - {Content}", Provider, response.StatusCode, err);
            throw new InvalidOperationException($"{Provider} API returned {response.StatusCode}: {err}");
        }

        var json = await response.Content.ReadAsStringAsync(cancellationToken);
        var text = ExtractTextFromResponse(json);
        return cleanJson ? CleanJsonResponse(text) : text.Trim();
    }

    // ── Provider-agnostic core: streaming ────────────────────────────────

    private async IAsyncEnumerable<string> StreamTextAsync(
        string? systemPrompt,
        IEnumerable<(string role, string content)> messages,
        double temperature,
        int maxTokens,
        [EnumeratorCancellation] CancellationToken cancellationToken)
    {
        using var request = BuildRequest(systemPrompt, messages, temperature, maxTokens, stream: true, GetStreamUrl());

        using var response = await _httpClient.SendAsync(request, HttpCompletionOption.ResponseHeadersRead, cancellationToken);
        if (!response.IsSuccessStatusCode)
        {
            var err = await response.Content.ReadAsStringAsync(cancellationToken);
            throw new InvalidOperationException($"{Provider} streaming API returned {response.StatusCode}: {err}");
        }

        using var stream = await response.Content.ReadAsStreamAsync(cancellationToken);
        using var reader = new StreamReader(stream);

        while (true)
        {
            cancellationToken.ThrowIfCancellationRequested();
            var line = await reader.ReadLineAsync(cancellationToken);
            if (line == null) break;
            if (!line.StartsWith("data: ")) continue;

            var data = line[6..].TrimEnd();
            if (data == "[DONE]") break;
            if (string.IsNullOrEmpty(data)) continue;

            string? text = null;
            try { text = ExtractChunkText(data); }
            catch { }

            if (!string.IsNullOrEmpty(text))
                yield return text;
        }
    }

    // ── Request builder ───────────────────────────────────────────────────

    private HttpRequestMessage BuildRequest(
        string? systemPrompt,
        IEnumerable<(string role, string content)> messages,
        double temperature,
        int maxTokens,
        bool stream,
        string url)
    {
        object body;

        if (Provider == "gemini")
        {
            var contents = messages.Select(m => new
            {
                role = m.role == "assistant" ? "model" : m.role,
                parts = new[] { new { text = m.content } }
            });
            body = systemPrompt != null
                ? (object)new { systemInstruction = new { parts = new[] { new { text = systemPrompt } } }, contents, generationConfig = new { temperature, maxOutputTokens = maxTokens } }
                : new { contents, generationConfig = new { temperature, maxOutputTokens = maxTokens } };
        }
        else if (Provider == "claude")
        {
            var claudeMessages = messages
                .Select(m => new { role = m.role == "model" ? "assistant" : m.role, content = m.content })
                .ToList();
            body = systemPrompt != null
                ? (object)new { model = Model, max_tokens = maxTokens, system = systemPrompt, messages = claudeMessages, temperature, stream }
                : new { model = Model, max_tokens = maxTokens, messages = claudeMessages, temperature, stream };
        }
        else
        {
            // OpenAI-compatible: openai, deepseek, kimi, doubao, grok, qwen, wenxin
            var msgList = new List<object>();
            if (systemPrompt != null)
                msgList.Add(new { role = "system", content = systemPrompt });
            foreach (var m in messages)
                msgList.Add(new { role = m.role == "model" ? "assistant" : m.role, content = m.content });
            body = new { model = Model, messages = msgList, temperature, max_tokens = maxTokens, stream };
        }

        var request = new HttpRequestMessage(HttpMethod.Post, url)
        {
            Content = new StringContent(JsonSerializer.Serialize(body), Encoding.UTF8, "application/json")
        };

        if (Provider == "claude")
        {
            request.Headers.Add("x-api-key", ApiKey);
            request.Headers.Add("anthropic-version", "2023-06-01");
        }
        else if (Provider != "gemini")
        {
            request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", ApiKey);
        }

        return request;
    }

    // ── Response text extraction ──────────────────────────────────────────

    private string ExtractTextFromResponse(string json)
    {
        using var doc = JsonDocument.Parse(json);
        if (Provider == "gemini")
            return doc.RootElement
                .GetProperty("candidates")[0]
                .GetProperty("content").GetProperty("parts")[0]
                .GetProperty("text").GetString()
                ?? throw new InvalidOperationException("No response from Gemini.");

        if (Provider == "claude")
            return doc.RootElement
                .GetProperty("content")[0]
                .GetProperty("text").GetString()
                ?? throw new InvalidOperationException("No response from Claude.");

        // OpenAI-compatible
        return doc.RootElement
            .GetProperty("choices")[0]
            .GetProperty("message").GetProperty("content").GetString()
            ?? throw new InvalidOperationException($"No response from {Provider}.");
    }

    private string? ExtractChunkText(string data)
    {
        using var doc = JsonDocument.Parse(data);

        if (Provider == "gemini")
        {
            if (!doc.RootElement.TryGetProperty("candidates", out var candidates)) return null;
            return candidates[0].GetProperty("content").GetProperty("parts")[0].GetProperty("text").GetString();
        }

        if (Provider == "claude")
        {
            if (!doc.RootElement.TryGetProperty("type", out var typeEl)) return null;
            if (typeEl.GetString() != "content_block_delta") return null;
            return doc.RootElement.GetProperty("delta").GetProperty("text").GetString();
        }

        // OpenAI-compatible
        if (!doc.RootElement.TryGetProperty("choices", out var choices)) return null;
        var delta = choices[0].GetProperty("delta");
        return delta.TryGetProperty("content", out var content) ? content.GetString() : null;
    }

    // ── Provider-aware file request builder ──────────────────────────────

    private HttpRequestMessage BuildFileRequest(
        byte[] fileData,
        string mimeType,
        string prompt,
        double temperature,
        int maxTokens,
        bool stream,
        string url)
    {
        var base64Data = Convert.ToBase64String(fileData);
        object body;

        if (Provider == "gemini")
        {
            body = new
            {
                contents = new[]
                {
                    new
                    {
                        parts = new object[]
                        {
                            new { inlineData = new { mimeType, data = base64Data } },
                            new { text = prompt }
                        }
                    }
                },
                generationConfig = new { temperature, maxOutputTokens = maxTokens }
            };
        }
        else if (Provider == "claude")
        {
            object fileContent = mimeType == "application/pdf"
                ? (object)new { type = "document", source = new { type = "base64", media_type = mimeType, data = base64Data } }
                : new { type = "image", source = new { type = "base64", media_type = mimeType, data = base64Data } };

            body = new
            {
                model = Model,
                max_tokens = maxTokens,
                messages = new[]
                {
                    new
                    {
                        role = "user",
                        content = new object[] { fileContent, new { type = "text", text = prompt } }
                    }
                },
                temperature,
                stream
            };
        }
        else
        {
            // OpenAI-compatible: send image as base64 data URL in content array
            var dataUrl = $"data:{mimeType};base64,{base64Data}";
            body = new
            {
                model = Model,
                messages = new[]
                {
                    new
                    {
                        role = "user",
                        content = new object[]
                        {
                            new { type = "image_url", image_url = new { url = dataUrl } },
                            new { type = "text", text = prompt }
                        }
                    }
                },
                max_tokens = maxTokens,
                temperature,
                stream
            };
        }

        var request = new HttpRequestMessage(HttpMethod.Post, url)
        {
            Content = new StringContent(JsonSerializer.Serialize(body), Encoding.UTF8, "application/json")
        };

        if (Provider == "claude")
        {
            request.Headers.Add("x-api-key", ApiKey);
            request.Headers.Add("anthropic-version", "2023-06-01");
        }
        else if (Provider != "gemini")
        {
            request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", ApiKey);
        }

        return request;
    }

    // ── Provider-aware file core: non-streaming ───────────────────────────

    private Task<string> CallAiWithFileAsync(byte[] fileData, string mimeType, string prompt, CancellationToken cancellationToken, bool cleanJson = true)
        => SendFileTextAsync(fileData, mimeType, prompt, 0.7, 8192, cleanJson, cancellationToken);

    private async Task<string> SendFileTextAsync(
        byte[] fileData,
        string mimeType,
        string prompt,
        double temperature,
        int maxTokens,
        bool cleanJson,
        CancellationToken cancellationToken)
    {
        using var request = BuildFileRequest(fileData, mimeType, prompt, temperature, maxTokens, stream: false, GetNonStreamUrl());

        using var response = await _httpClient.SendAsync(request, cancellationToken);
        if (!response.IsSuccessStatusCode)
        {
            var err = await response.Content.ReadAsStringAsync(cancellationToken);
            _logger.LogError("{Provider} API error: {Status} - {Content}", Provider, response.StatusCode, err);
            throw new InvalidOperationException($"{Provider} API returned {response.StatusCode}: {err}");
        }

        var json = await response.Content.ReadAsStringAsync(cancellationToken);
        var text = ExtractTextFromResponse(json);
        return cleanJson ? CleanJsonResponse(text) : text.Trim();
    }

    // ── Provider-aware file core: streaming ──────────────────────────────

    private async IAsyncEnumerable<string> StreamFileTextAsync(
        byte[] fileData,
        string mimeType,
        string prompt,
        double temperature,
        int maxTokens,
        [EnumeratorCancellation] CancellationToken cancellationToken)
    {
        using var request = BuildFileRequest(fileData, mimeType, prompt, temperature, maxTokens, stream: true, GetStreamUrl());

        using var response = await _httpClient.SendAsync(request, HttpCompletionOption.ResponseHeadersRead, cancellationToken);
        if (!response.IsSuccessStatusCode)
        {
            var err = await response.Content.ReadAsStringAsync(cancellationToken);
            throw new InvalidOperationException($"{Provider} streaming API returned {response.StatusCode}: {err}");
        }

        using var stream = await response.Content.ReadAsStreamAsync(cancellationToken);
        using var reader = new StreamReader(stream);

        while (true)
        {
            cancellationToken.ThrowIfCancellationRequested();
            var line = await reader.ReadLineAsync(cancellationToken);
            if (line == null) break;
            if (!line.StartsWith("data: ")) continue;

            var data = line[6..].TrimEnd();
            if (data == "[DONE]") break;
            if (string.IsNullOrEmpty(data)) continue;

            string? text = null;
            try { text = ExtractChunkText(data); }
            catch { }

            if (!string.IsNullOrEmpty(text))
                yield return text;
        }
    }

    // ── Streaming summary ─────────────────────────────────────────────────

    public async IAsyncEnumerable<string> StreamSummaryAsync(byte[] fileData, string mimeType, [EnumeratorCancellation] CancellationToken cancellationToken = default)
    {
        await foreach (var chunk in StreamFileTextAsync(fileData, mimeType, Prompts.StreamSummary, 0.7, 8192, cancellationToken))
            yield return chunk;
    }

    public async IAsyncEnumerable<string> StreamSummaryAsync(string textContent, [EnumeratorCancellation] CancellationToken cancellationToken = default)
    {
        var prompt = $"{Prompts.StreamSummary}\n\nSource material:\n{TruncateContent(textContent)}";
        await foreach (var chunk in StreamTextAsync(null, [("user", prompt)], 0.7, 8192, cancellationToken))
            yield return chunk;
    }

    public async IAsyncEnumerable<string> StreamTimelineSummaryAsync(string timedTranscript, string mediaType, [EnumeratorCancellation] CancellationToken cancellationToken = default)
    {
        var prompt = $"{Prompts.TimelineStreamSummary(mediaType)}\n\nTimestamped source material:\n{TruncateContent(timedTranscript)}";
        await foreach (var chunk in StreamTextAsync(null, [("user", prompt)], 0.7, 8192, cancellationToken))
            yield return chunk;
    }

    public async IAsyncEnumerable<string> StreamSummaryFromYouTubeAsync(string transcriptText, [EnumeratorCancellation] CancellationToken cancellationToken = default)
    {
        var prompt = $"{Prompts.TimelineStreamSummary("video")}\n\nTimestamped source material:\n{TruncateContent(transcriptText)}";
        await foreach (var chunk in StreamTextAsync(null, [("user", prompt)], 0.7, 8192, cancellationToken))
            yield return chunk;
    }

    // ── Streaming mind map ────────────────────────────────────────────────

    public async IAsyncEnumerable<string> StreamMindMapAsync(byte[] fileData, string mimeType, [EnumeratorCancellation] CancellationToken cancellationToken = default)
    {
        await foreach (var chunk in StreamFileTextAsync(fileData, mimeType, Prompts.MindMap, 0.35, 4096, cancellationToken))
            yield return chunk;
    }

    public async IAsyncEnumerable<string> StreamMindMapAsync(string textContent, [EnumeratorCancellation] CancellationToken cancellationToken = default)
    {
        var prompt = $"{Prompts.MindMap}\n\nSource material:\n{TruncateContent(textContent)}";
        await foreach (var chunk in StreamTextAsync(null, [("user", prompt)], 0.35, 4096, cancellationToken))
            yield return chunk;
    }

    public async IAsyncEnumerable<string> StreamMindMapFromYouTubeAsync(string transcriptText, [EnumeratorCancellation] CancellationToken cancellationToken = default)
    {
        var prompt = $"{Prompts.YouTubeMindMap}\n\nSource material:\n{TruncateContent(transcriptText)}";
        await foreach (var chunk in StreamTextAsync(null, [("user", prompt)], 0.35, 4096, cancellationToken))
            yield return chunk;
    }

    // ── Streaming chat ────────────────────────────────────────────────────

    public async IAsyncEnumerable<string> StreamChatAsync(string documentContent, string userMessage, IEnumerable<(string role, string content)> history, [EnumeratorCancellation] CancellationToken cancellationToken = default)
    {
        var prompt = BuildDocumentChatPrompt(TruncateContent(documentContent, 3000), string.Join("\n", history.Select(h => $"{h.role.ToUpper()}: {h.content}")), userMessage);
        await foreach (var chunk in StreamTextAsync(null, [("user", prompt)], 0.7, 8192, cancellationToken))
            yield return chunk;
    }

    public async IAsyncEnumerable<string> StreamChatWithYouTubeAsync(string transcriptText, IEnumerable<(string role, string content)> history, string message, [EnumeratorCancellation] CancellationToken cancellationToken = default)
    {
        var system = string.IsNullOrWhiteSpace(transcriptText)
            ? Prompts.YouTubeTutorInstruction
            : $"{Prompts.YouTubeTutorInstruction}\n\n[Source context]\n{TruncateContent(transcriptText)}";

        var messages = history.Append(("user", message));
        await foreach (var chunk in StreamTextAsync(system, messages, 0.7, 8192, cancellationToken))
            yield return chunk;
    }

    public async IAsyncEnumerable<string> StreamGeneralChatAsync(IEnumerable<(string role, string content)> history, string message, [EnumeratorCancellation] CancellationToken cancellationToken = default)
    {
        var messages = history.Append(("user", message));
        await foreach (var chunk in StreamTextAsync(Prompts.GeneralTutorInstruction, messages, 0.7, 8192, cancellationToken))
            yield return chunk;
    }

    // ── Utilities ─────────────────────────────────────────────────────────

    private static string BuildDocumentChatPrompt(string truncatedDoc, string historyText, string userMessage) =>
        $@"You are a knowledgeable AI assistant. Answer the user's question using your broad general knowledge. The source context below is supplementary; use it when relevant, but do not restrict answers to only that context.

Source context:
{truncatedDoc}

Conversation history:
{historyText}

USER: {userMessage}

Provide a helpful, accurate, and complete answer. Discuss ideas directly and do not mention the source format or use phrases like ""this document"", ""the document"", ""this video"", ""the video"", ""the transcript"", ""the source material"", or ""the content"" unless quoting the user.";

    private static string CleanJsonResponse(string text)
    {
        text = text.Trim();
        if (text.StartsWith("```json")) text = text[7..];
        else if (text.StartsWith("```")) text = text[3..];
        if (text.EndsWith("```")) text = text[..^3];
        text = text.Trim();

        var objStart = text.IndexOf('{');
        var arrStart = text.IndexOf('[');
        var jsonStart = (objStart, arrStart) switch
        {
            ( >= 0, >= 0) => Math.Min(objStart, arrStart),
            ( >= 0, _) => objStart,
            (_, >= 0) => arrStart,
            _ => -1
        };
        if (jsonStart >= 0) text = text[jsonStart..];

        var jsonEnd = FindJsonEnd(text);
        if (jsonEnd > 0) text = text[..jsonEnd];

        return text.Trim();
    }

    private static string CleanTextResponse(string text)
    {
        text = text.Trim();
        if (text.StartsWith("```"))
        {
            var firstNewline = text.IndexOf('\n');
            if (firstNewline >= 0) text = text[(firstNewline + 1)..];
        }
        if (text.EndsWith("```")) text = text[..^3];
        return text.Trim();
    }

    private static int FindJsonEnd(string text)
    {
        if (text.Length == 0) return -1;
        char open = text[0];
        char close = open == '{' ? '}' : open == '[' ? ']' : '\0';
        if (close == '\0') return -1;

        int depth = 0;
        bool inString = false, escaped = false;
        for (int i = 0; i < text.Length; i++)
        {
            char c = text[i];
            if (escaped) { escaped = false; continue; }
            if (c == '\\' && inString) { escaped = true; continue; }
            if (c == '"') { inString = !inString; continue; }
            if (inString) continue;
            if (c == open) depth++;
            else if (c == close) { depth--; if (depth == 0) return i + 1; }
        }
        return -1;
    }

    private static string TruncateContent(string content, int maxLength = 10000)
        => content.Length <= maxLength ? content : content[..maxLength] + "\n[Source truncated...]";

    // ── Prompts ───────────────────────────────────────────────────────────

    private static class Prompts
    {
        private const string NoSourceMetaPhrases =
            @"Do not mention the source format or refer to the material with meta phrases such as ""this document"", ""the document"", ""this video"", ""the video"", ""the transcript"", ""the source material"", ""the content"", ""the text"", ""the speaker"", ""the lecture"", or similar wording. Discuss the ideas directly.";

        public const string MindMap =
            @"Create a detailed hierarchical study mind map in XMindMark format.
STRICT RULES:
Output ONLY the mind map text. No explanations, no JSON, no code fences.
First line MUST be the single root topic.
Use -  with exactly 4 spaces indentation per level.
Maximum 4 levels: Root → Main → Sub → Detail.
Make the map comprehensive enough for exam revision, not just a table of contents.
Use 5-9 main branches covering all major themes, arguments, processes, definitions, examples, and conclusions.
Each main branch should usually have 3-6 sub-branches.
Each sub-branch should usually have 2-4 detail nodes with specific facts, mechanisms, formulas, examples, causes, effects, limitations, or comparisons from the source.
Main and sub-branch nodes should be concise labels, usually 2-8 words.
Detail nodes may be short phrases up to 18 words when needed to preserve meaning.
Include named entities, key numbers, dates, formulas, assumptions, and concrete examples when present.
Avoid generic nodes such as Overview, Important Points, Key Ideas, or Conclusion unless the source uses them as real section topics.
Avoid repetition; merge duplicates and keep each branch conceptually distinct.
Do not invent details not supported by the source.
Do not include meta phrases about the source format in any node.
Example:
Main Topic
- Core Concept
    - Definition
        - Precise meaning from source
        - Related term or contrast
    - Why It Matters
        - Practical consequence
        - Common misconception
- Process or Framework
    - Step One
        - Trigger or input
        - Important constraint";

        public static readonly string Quiz =
            $@"Generate 5 to 10 multiple-choice questions from the supplied study material.
{NoSourceMetaPhrases}
Each question must have exactly 4 options. Each option must start with ""A) "", ""B) "", ""C) "", ""D) "" respectively.
correctAnswer MUST be only the matching letter: ""A"", ""B"", ""C"", or ""D"". Do not put the answer text in correctAnswer.
Return a JSON array only, no markdown, no code blocks:
[{{""question"": ""..."", ""options"": [""A) ..."",""B) ..."",""C) ..."",""D) ...""], ""correctAnswer"": ""A"", ""explanation"": ""...""}}]";

        public static string QuizForDifficulty(string difficulty) =>
            $@"{Quiz}
Difficulty: {QuizDifficultyLabel(difficulty)}.
Beginner questions should focus on recall and understanding.
Intermediate questions should focus on understanding and application.
Advanced questions should focus on application and analysis.";

        public static readonly string Flashcards =
            $@"Generate 15 flashcards from the supplied study material for spaced repetition learning.
{NoSourceMetaPhrases}
Use up to three card types — about 55% basic, 35% cloze, and up to 10% chart (only when quantitative data is present):
- basic: question on the front, concise answer on the back. Use LaTeX math ($...$) for formulas.
- cloze: a sentence with ONE key term in {{{{double braces}}}}. Leave back empty or a short hint.
- chart: front is a question about data; back is empty; add a chartData object.
  Only use chart when the source contains clear numerical or comparative data.
  chartData schema: {{""type"":""bar""|""line""|""pie"",""title"":""..."",""labels"":[...],""datasets"":[{{""label"":""..."",""data"":[numbers]}}]}}
Return a JSON array only, no markdown, no code blocks:
[{{""type"":""basic"",""front"":""..."",""back"":""...""}},{{""type"":""cloze"",""front"":""..{{{{term}}}}..."",""back"":""""}},{{""type"":""chart"",""front"":""..."",""back"":"""",""chartData"":{{""type"":""bar"",""title"":""..."",""labels"":[""A"",""B""],""datasets"":[{{""label"":""X"",""data"":[1,2]}}]}}}}]";

        public static readonly string Glossary =
            $@"Extract 10-20 key terms and their definitions from the supplied study material.
{NoSourceMetaPhrases}
Focus on technical terms, concepts, and domain-specific vocabulary.
Return a JSON array only, no markdown, no code blocks: [{{""term"": ""..."", ""definition"": ""...""}}]";

        public static readonly string StreamSummary =
            $"Write a Markdown study summary. Start with exactly one concise, professional, academic overview paragraph covering the main thesis and conclusions. {NoSourceMetaPhrases} Follow with a '## Key Concepts' section explaining the most important ideas in detail. Then add a '## Key Takeaways' bullet list of 3-6 specific, informative points using '- '.";

        public static readonly string YouTubeStreamSummary =
            $"Write a Markdown study summary. Start with exactly one concise, professional, academic overview paragraph covering the main topic and conclusions. {NoSourceMetaPhrases} Follow with a '## Key Concepts' section explaining the most important ideas in detail. Then add a '## Key Takeaways' bullet list of 3-6 specific, informative points using '- '.";

        public static string TimelineStreamSummary(string mediaType) =>
            $@"Write a timeline-based study summary in Markdown.
Start with exactly one concise, professional, academic overview paragraph covering the main topic and conclusions.
{NoSourceMetaPhrases}
Then add a '## Timeline Summary' section with 3-6 chronological paragraphs. Each paragraph MUST start with a timestamp range from the timestamped source, formatted like '00:00 - 02:15' or '1:00:00 - 1:02:15', followed by a clear summary of what happens or is explained across that segment.
Group nearby timestamped fragments into meaningful segments instead of listing every line.
After the timeline, add a '## Key Concepts' section explaining the most important ideas in detail.
Finish with a '## Key Takeaways' bullet list of 3-6 specific, informative points using '- '.
Use only timestamp ranges that appear in or can be directly inferred from the supplied timestamps. If no timestamps are available, still summarize chronologically but omit timestamp prefixes.";

        public const string YouTubeMindMap =
            @"Generate a detailed study mind map from the supplied study material in XMindMark format.
STRICT RULES:
Output ONLY the mind map text. No explanations, no JSON, no code fences.
First line MUST be the single root topic.
Use -  with exactly 4 spaces indentation per level.
Maximum 4 levels: Root → Main → Sub → Detail.
Make the map comprehensive enough for exam revision, not just a video outline.
Use 5-9 main branches covering all major themes, arguments, processes, definitions, examples, demonstrations, and conclusions.
Each main branch should usually have 3-6 sub-branches.
Each sub-branch should usually have 2-4 detail nodes with specific facts, mechanisms, formulas, examples, causes, effects, limitations, or comparisons from the source.
Main and sub-branch nodes should be concise labels, usually 2-8 words.
Detail nodes may be short phrases up to 18 words when needed to preserve meaning.
Include named entities, key numbers, dates, formulas, assumptions, and concrete examples when present.
Preserve important sequence or cause-effect relationships.
Avoid generic nodes such as Overview, Important Points, Key Ideas, or Conclusion unless they are real section topics.
Avoid repetition; merge duplicates and keep each branch conceptually distinct.
Do not invent details not supported by the source.
Do not include meta phrases about the source format in any node.
Example:
Main Topic
- Core Concept
    - Definition
        - Precise meaning from source
        - Related term or contrast
    - Example
        - Specific example
        - Why example matters
- Demonstration or Process
    - Step One
        - Trigger or input
        - Important constraint";

        public static readonly string YouTubeQuiz =
            $@"Generate 5 to 10 multiple-choice quiz questions from the supplied study material.
{NoSourceMetaPhrases}
Each question must have exactly 4 options. Each option must start with ""A. "", ""B. "", ""C. "", ""D. "" respectively.
correctAnswer MUST be only the matching letter: ""A"", ""B"", ""C"", or ""D"". Do not put the answer text in correctAnswer.
Return a JSON array only, no markdown, no code blocks:
[{{""question"":""..."",""options"":[""A. ..."",""B. ..."",""C. ..."",""D. ...""],""correctAnswer"":""A"",""explanation"":""...""}}]";

        public static string YouTubeQuizForDifficulty(string difficulty) =>
            $@"{YouTubeQuiz}
Difficulty: {QuizDifficultyLabel(difficulty)}.
Beginner questions should focus on recall and understanding.
Intermediate questions should focus on understanding and application.
Advanced questions should focus on application and analysis.";

        private static string QuizDifficultyLabel(string difficulty) => difficulty?.ToLowerInvariant() switch
        {
            "easy" => "Beginner",
            "hard" => "Advanced",
            _ => "Intermediate"
        };

        public static readonly string YouTubeFlashcards =
            $@"Generate 5 to 10 flashcards from the supplied study material, focusing on the most important concepts only.
{NoSourceMetaPhrases}
Use up to three card types — about 55% basic, 35% cloze, and up to 10% chart (only if the video discusses quantitative data):
- basic: question on the front, concise answer on the back. Use LaTeX math ($...$) for formulas.
- cloze: a sentence with ONE key term in {{{{double braces}}}}. Leave back empty or a short hint.
- chart: front is a question; back is empty; include a chartData object (only when clear numerical data exists).
  chartData schema: {{""type"":""bar""|""line""|""pie"",""title"":""..."",""labels"":[...],""datasets"":[{{""label"":""..."",""data"":[numbers]}}]}}
Return a JSON array only, no markdown, no code blocks:
[{{""type"":""basic"",""front"":""..."",""back"":""...""}},{{""type"":""cloze"",""front"":""..{{{{term}}}}..."",""back"":""""}}]";

        public static readonly string YouTubeTutorInstruction =
            $"You are a knowledgeable AI assistant. Answer questions using your broad general knowledge. Source context may be supplied as supplementary context; use it when relevant, but do not restrict answers to only that context. If the user asks something beyond the context, answer from general knowledge. {NoSourceMetaPhrases}";

        public const string GeneralTutorInstruction =
            "You are a knowledgeable AI assistant. Answer any question the user asks using your broad general knowledge. Give clear, accurate, and helpful responses. Adjust depth to match the complexity of the question — be concise for simple questions, and thorough for complex ones.";
    }

    // ── OCR ───────────────────────────────────────────────────────────────

    public Task<string> ExtractTextFromImageAsync(byte[] imageData, string mimeType, CancellationToken cancellationToken = default)
        => CallAiWithFileAsync(imageData, mimeType,
            "Extract all text visible in this image verbatim. Return only the raw extracted text, no commentary.",
            cancellationToken, cleanJson: false);

    // ── Phase 2 additions ─────────────────────────────────────────────────

    public Task<string> GenerateWorkedProblemsAsync(string content, string difficulty, int count, CancellationToken cancellationToken = default)
    {
        var prompt = $@"Generate {count} {difficulty}-difficulty worked problems from the supplied study material. Do not use meta phrases such as ""this document"", ""the document"", ""this video"", ""the video"", ""the transcript"", ""the source material"", ""the content"", or similar wording in any generated field. Return a JSON array where each element has: problem (string), steps (array of objects with stepNumber (int), description (string), formula (string, optional)), answer (string), topic (string). Return ONLY the JSON array, no other text.

Source material:
{TruncateContent(content)}";
        return CacheGeneratedResultAsync(
            "worked-problems:text",
            HashText(prompt),
            ct => SendTextAsync(null, [("user", prompt)], 0.7, 8192, cleanJson: true, ct),
            cancellationToken);
    }

    public Task<string> EvaluateProblemAttemptAsync(string problem, string solution, string userAnswer, CancellationToken cancellationToken = default)
    {
        var prompt = $@"Evaluate the student's answer to this problem. Return a JSON object with: isCorrect (bool), evaluation (string, constructive feedback explaining why the answer is correct or incorrect and what was missed).

Problem: {problem}
Correct Solution: {solution}
Student Answer: {userAnswer}

Return ONLY the JSON object, no other text.";
        return SendTextAsync(null, [("user", prompt)], 0.3, 1024, cleanJson: true, cancellationToken);
    }

    public Task<string> AnswerQuestionAsync(string documentContent, string question, CancellationToken cancellationToken = default)
    {
        var prompt = $@"Answer the following question using the supplied source context when relevant. Give a clear, accurate, and helpful answer. Do not mention the source format or use meta phrases such as ""this document"", ""the document"", ""this video"", ""the video"", ""the transcript"", ""the source material"", ""the content"", or similar wording unless quoting the user.

Source context:
{TruncateContent(documentContent, 4000)}

Question: {question}

Answer:";
        return SendTextAsync(null, [("user", prompt)], 0.5, 2048, cleanJson: false, cancellationToken);
    }

}
