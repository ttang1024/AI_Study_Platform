using System.Net.Http.Headers;
using System.Runtime.CompilerServices;
using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Logging;
using StudyPlatform.Application.Services;

namespace StudyPlatform.Infrastructure.Services;

// Provider HTTP transport: request/response building, send & stream cores (text and file),
// plus the token accounting that wraps every call.
public partial class AiService
{
    // ── Provider-agnostic core: non-streaming ─────────────────────────────

    private async Task<string> SendTextAsync(
        string? systemPrompt,
        IEnumerable<(string role, string content)> messages,
        double temperature,
        int maxTokens,
        bool cleanJson,
        CancellationToken cancellationToken,
        [CallerMemberName] string operation = "")
    {
        await EnsureWithinQuotaAsync(cancellationToken);

        using var request = BuildRequest(systemPrompt, messages, temperature, maxTokens, stream: false, GetNonStreamUrl());

        using var response = await _httpClient.SendAsync(request, cancellationToken);
        if (!response.IsSuccessStatusCode)
        {
            var err = await response.Content.ReadAsStringAsync(cancellationToken);
            _logger.LogError("{Provider} API error: {Status} - {Content}", Provider, response.StatusCode, err);
            throw new InvalidOperationException($"{Provider} API returned {response.StatusCode}: {err}");
        }

        var json = await response.Content.ReadAsStringAsync(cancellationToken);
        await RecordUsageAsync(ExtractUsage(json), operation, streamed: false);

        var text = ExtractTextFromResponse(json);
        return cleanJson ? AiResponseParsing.CleanJsonResponse(text) : text.Trim();
    }

    // ── Provider-agnostic core: streaming ────────────────────────────────

    private async IAsyncEnumerable<string> StreamTextAsync(
        string? systemPrompt,
        IEnumerable<(string role, string content)> messages,
        double temperature,
        int maxTokens,
        [EnumeratorCancellation] CancellationToken cancellationToken,
        [CallerMemberName] string operation = "")
    {
        await EnsureWithinQuotaAsync(cancellationToken);

        using var request = BuildRequest(systemPrompt, messages, temperature, maxTokens, stream: true, GetStreamUrl());

        using var response = await _httpClient.SendAsync(request, HttpCompletionOption.ResponseHeadersRead, cancellationToken);
        if (!response.IsSuccessStatusCode)
        {
            var err = await response.Content.ReadAsStringAsync(cancellationToken);
            throw new InvalidOperationException($"{Provider} streaming API returned {response.StatusCode}: {err}");
        }

        var usage = new StreamUsageAccumulator();
        try
        {
            await foreach (var text in ReadSseAsync(response, usage, cancellationToken))
                yield return text;
        }
        finally
        {
            await RecordUsageAsync(usage.Result, operation, streamed: true);
        }
    }

    // ── SSE reading ───────────────────────────────────────────────────────

    /// <summary>
    /// Walks a provider's SSE body, yielding text deltas and feeding every frame to the usage
    /// accumulator — token counts arrive in their own frames, not alongside the text.
    /// </summary>
    private async IAsyncEnumerable<string> ReadSseAsync(
        HttpResponseMessage response,
        StreamUsageAccumulator usage,
        [EnumeratorCancellation] CancellationToken cancellationToken)
    {
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

            // Usage first, and outside the text try/catch: OpenAI-compatible providers deliver the
            // token counts in a trailing chunk that carries no text at all.
            usage.Observe(ExtractUsage(data));

            string? text = null;
            try { text = ExtractChunkText(data); }
            catch { }

            if (!string.IsNullOrEmpty(text))
                yield return text;
        }
    }

    // ── Token accounting ──────────────────────────────────────────────────

    private async Task EnsureWithinQuotaAsync(CancellationToken cancellationToken)
        => await _usageRecorder.EnsureWithinQuotaAsync(Credentials.UserId, cancellationToken);

    /// <summary>
    /// Accounting must not fail the call it is accounting for, and must still run when the caller
    /// walked away mid-stream — hence the swallow and the deliberate CancellationToken.None.
    /// </summary>
    private async Task RecordUsageAsync(AiTokenUsage usage, string operation, bool streamed)
    {
        if (usage.IsEmpty) return;

        var credentials = Credentials;
        if (credentials.UserId == Guid.Empty) return;

        try
        {
            await _usageRecorder.RecordAsync(
                new AiUsageRecord(
                    credentials.UserId,
                    credentials.Provider,
                    credentials.Model,
                    operation,
                    usage.PromptTokens,
                    usage.CompletionTokens,
                    usage.CachedPromptTokens,
                    streamed),
                CancellationToken.None);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to record AI usage for operation {Operation}", operation);
        }
    }

    private sealed record AiTokenUsage(int PromptTokens, int CompletionTokens, int CachedPromptTokens)
    {
        public static readonly AiTokenUsage Empty = new(0, 0, 0);
        public bool IsEmpty => PromptTokens == 0 && CompletionTokens == 0;
    }

    /// <summary>
    /// Streams report usage across several frames — Anthropic splits input tokens (message_start) from
    /// output tokens (message_delta), OpenAI sends one final usage-only chunk, Gemini repeats a running
    /// total on every chunk. Taking the max of each field handles all three without special-casing.
    /// </summary>
    private sealed class StreamUsageAccumulator
    {
        private int _prompt;
        private int _completion;
        private int _cached;

        public void Observe(AiTokenUsage usage)
        {
            _prompt = Math.Max(_prompt, usage.PromptTokens);
            _completion = Math.Max(_completion, usage.CompletionTokens);
            _cached = Math.Max(_cached, usage.CachedPromptTokens);
        }

        public AiTokenUsage Result => new(_prompt, _completion, _cached);
    }

    private AiTokenUsage ExtractUsage(string json)
    {
        try
        {
            using var doc = JsonDocument.Parse(json);
            var root = doc.RootElement;

            if (Provider == "gemini")
            {
                if (!root.TryGetProperty("usageMetadata", out var meta)) return AiTokenUsage.Empty;
                return new AiTokenUsage(
                    Int(meta, "promptTokenCount"),
                    Int(meta, "candidatesTokenCount"),
                    Int(meta, "cachedContentTokenCount"));
            }

            if (Provider == "claude")
            {
                // Usage hangs off the event's message on message_start, and off the event itself on message_delta.
                var usage = root.TryGetProperty("usage", out var direct)
                    ? direct
                    : root.TryGetProperty("message", out var message) && message.TryGetProperty("usage", out var nested)
                        ? nested
                        : default;
                if (usage.ValueKind != JsonValueKind.Object) return AiTokenUsage.Empty;

                return new AiTokenUsage(
                    Int(usage, "input_tokens") + Int(usage, "cache_read_input_tokens") + Int(usage, "cache_creation_input_tokens"),
                    Int(usage, "output_tokens"),
                    Int(usage, "cache_read_input_tokens"));
            }

            // OpenAI-compatible
            if (!root.TryGetProperty("usage", out var u) || u.ValueKind != JsonValueKind.Object)
                return AiTokenUsage.Empty;

            var cached = u.TryGetProperty("prompt_tokens_details", out var details) ? Int(details, "cached_tokens") : 0;
            return new AiTokenUsage(Int(u, "prompt_tokens"), Int(u, "completion_tokens"), cached);
        }
        catch
        {
            return AiTokenUsage.Empty;
        }

        static int Int(JsonElement element, string name)
            => element.TryGetProperty(name, out var value) && value.TryGetInt32(out var n) ? n : 0;
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
                ? (object)new { model = Model, max_tokens = maxTokens, system = ClaudeSystemBlocks(systemPrompt), messages = claudeMessages, temperature, stream }
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
            body = OpenAiCompatibleBody(msgList, temperature, maxTokens, stream);
        }

        return BuildHttpRequest(url, body);
    }

    /// <summary>
    /// OpenAI-compatible providers only report token usage on a stream when asked to, and they report
    /// it in a final usage-only chunk. Without this the whole streaming path bills nothing.
    /// </summary>
    private object OpenAiCompatibleBody(List<object> messages, double temperature, int maxTokens, bool stream)
        => stream
            ? new { model = Model, messages, temperature, max_tokens = maxTokens, stream, stream_options = new { include_usage = true } }
            : (object)new { model = Model, messages, temperature, max_tokens = maxTokens, stream };

    // Anything under this isn't worth a cache breakpoint — providers won't cache short prefixes,
    // and Anthropic bills a write premium on the first call that creates the entry.
    private const int MinCacheablePromptChars = 2000;

    /// <summary>
    /// Marks a long system prompt as cacheable. Document/transcript context lives in the system block
    /// and is byte-identical across a conversation's turns, so every turn after the first reads it from
    /// the provider's cache instead of paying full input rate to resend it.
    /// </summary>
    private static object ClaudeSystemBlocks(string systemPrompt)
        => systemPrompt.Length >= MinCacheablePromptChars
            ? new object[]
            {
                new
                {
                    type = "text",
                    text = systemPrompt,
                    cache_control = new { type = "ephemeral" },
                }
            }
            : systemPrompt;

    private HttpRequestMessage BuildHttpRequest(string url, object body)
    {
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

        // OpenAI-compatible. The trailing usage chunk carries an empty choices array.
        if (!doc.RootElement.TryGetProperty("choices", out var choices) || choices.GetArrayLength() == 0) return null;
        if (!choices[0].TryGetProperty("delta", out var delta)) return null;
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
            var msgList = new List<object>
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
            };
            body = OpenAiCompatibleBody(msgList, temperature, maxTokens, stream);
        }

        return BuildHttpRequest(url, body);
    }

    // ── Provider-aware multimodal request builder (history + attachments) ─

    // Builds a chat request where the final user turn carries one or more
    // image/PDF attachments alongside text, preserving prior conversation
    // history and the system prompt. Mirrors the per-provider shapes used by
    // BuildRequest / BuildFileRequest.
    private HttpRequestMessage BuildMultimodalRequest(
        string? systemPrompt,
        IEnumerable<(string role, string content)> history,
        string userMessage,
        IReadOnlyList<(byte[] data, string mimeType)> attachments,
        double temperature,
        int maxTokens,
        bool stream,
        string url)
    {
        object body;

        if (Provider == "gemini")
        {
            var contents = new List<object>();
            foreach (var m in history)
                contents.Add(new { role = m.role == "assistant" ? "model" : m.role, parts = new object[] { new { text = m.content } } });

            var parts = new List<object>();
            foreach (var (data, mimeType) in attachments)
                parts.Add(new { inlineData = new { mimeType, data = Convert.ToBase64String(data) } });
            parts.Add(new { text = userMessage });
            contents.Add(new { role = "user", parts = parts.ToArray() });

            body = systemPrompt != null
                ? (object)new { systemInstruction = new { parts = new[] { new { text = systemPrompt } } }, contents, generationConfig = new { temperature, maxOutputTokens = maxTokens } }
                : new { contents, generationConfig = new { temperature, maxOutputTokens = maxTokens } };
        }
        else if (Provider == "claude")
        {
            var messages = new List<object>();
            foreach (var m in history)
                messages.Add(new { role = m.role == "model" ? "assistant" : m.role, content = m.content });

            var content = new List<object>();
            foreach (var (data, mimeType) in attachments)
            {
                var base64 = Convert.ToBase64String(data);
                content.Add(mimeType == "application/pdf"
                    ? (object)new { type = "document", source = new { type = "base64", media_type = mimeType, data = base64 } }
                    : new { type = "image", source = new { type = "base64", media_type = mimeType, data = base64 } });
            }
            content.Add(new { type = "text", text = userMessage });
            messages.Add(new { role = "user", content = content.ToArray() });

            body = systemPrompt != null
                ? (object)new { model = Model, max_tokens = maxTokens, system = ClaudeSystemBlocks(systemPrompt), messages, temperature, stream }
                : new { model = Model, max_tokens = maxTokens, messages, temperature, stream };
        }
        else
        {
            // OpenAI-compatible: images travel as base64 data URLs. Non-image
            // attachments (e.g. PDFs) are not supported by these providers, so
            // they're dropped — the caller validates and warns the user upstream.
            var msgList = new List<object>();
            if (systemPrompt != null)
                msgList.Add(new { role = "system", content = systemPrompt });
            foreach (var m in history)
                msgList.Add(new { role = m.role == "model" ? "assistant" : m.role, content = m.content });

            var content = new List<object>();
            foreach (var (data, mimeType) in attachments)
            {
                if (!mimeType.StartsWith("image/")) continue;
                content.Add(new { type = "image_url", image_url = new { url = $"data:{mimeType};base64,{Convert.ToBase64String(data)}" } });
            }
            content.Add(new { type = "text", text = userMessage });
            msgList.Add(new { role = "user", content = content.ToArray() });

            body = OpenAiCompatibleBody(msgList, temperature, maxTokens, stream);
        }

        return BuildHttpRequest(url, body);
    }

    // ── Provider-aware multimodal core: non-streaming ─────────────────────

    private async Task<string> SendMultimodalTextAsync(
        string? systemPrompt,
        IEnumerable<(string role, string content)> history,
        string userMessage,
        IReadOnlyList<(byte[] data, string mimeType)> attachments,
        double temperature,
        int maxTokens,
        bool cleanJson,
        CancellationToken cancellationToken,
        [CallerMemberName] string operation = "")
    {
        await EnsureWithinQuotaAsync(cancellationToken);

        using var request = BuildMultimodalRequest(
            systemPrompt, history, userMessage, attachments, temperature, maxTokens, stream: false, GetNonStreamUrl());

        using var response = await _httpClient.SendAsync(request, cancellationToken);
        if (!response.IsSuccessStatusCode)
        {
            var err = await response.Content.ReadAsStringAsync(cancellationToken);
            _logger.LogError("{Provider} API error: {Status} - {Content}", Provider, response.StatusCode, err);
            throw new InvalidOperationException($"{Provider} API returned {response.StatusCode}: {err}");
        }

        var json = await response.Content.ReadAsStringAsync(cancellationToken);
        await RecordUsageAsync(ExtractUsage(json), operation, streamed: false);

        var text = ExtractTextFromResponse(json);
        return cleanJson ? AiResponseParsing.CleanJsonResponse(text) : text.Trim();
    }

    // ── Provider-aware multimodal core: streaming ─────────────────────────

    private async IAsyncEnumerable<string> StreamMultimodalTextAsync(
        string? systemPrompt,
        IEnumerable<(string role, string content)> history,
        string userMessage,
        IReadOnlyList<(byte[] data, string mimeType)> attachments,
        double temperature,
        int maxTokens,
        [EnumeratorCancellation] CancellationToken cancellationToken,
        [CallerMemberName] string operation = "")
    {
        await EnsureWithinQuotaAsync(cancellationToken);

        using var request = BuildMultimodalRequest(systemPrompt, history, userMessage, attachments, temperature, maxTokens, stream: true, GetStreamUrl());

        using var response = await _httpClient.SendAsync(request, HttpCompletionOption.ResponseHeadersRead, cancellationToken);
        if (!response.IsSuccessStatusCode)
        {
            var err = await response.Content.ReadAsStringAsync(cancellationToken);
            throw new InvalidOperationException($"{Provider} streaming API returned {response.StatusCode}: {err}");
        }

        var usage = new StreamUsageAccumulator();
        try
        {
            await foreach (var text in ReadSseAsync(response, usage, cancellationToken))
                yield return text;
        }
        finally
        {
            await RecordUsageAsync(usage.Result, operation, streamed: true);
        }
    }

    // ── Provider-aware file core: non-streaming ───────────────────────────

    private Task<string> CallAiWithFileAsync(byte[] fileData, string mimeType, string prompt, CancellationToken cancellationToken, bool cleanJson = true, [CallerMemberName] string operation = "")
        => SendFileTextAsync(fileData, mimeType, prompt, 0.7, 8192, cleanJson, cancellationToken, operation);

    private async Task<string> SendFileTextAsync(
        byte[] fileData,
        string mimeType,
        string prompt,
        double temperature,
        int maxTokens,
        bool cleanJson,
        CancellationToken cancellationToken,
        [CallerMemberName] string operation = "")
    {
        await EnsureWithinQuotaAsync(cancellationToken);

        using var request = BuildFileRequest(fileData, mimeType, prompt, temperature, maxTokens, stream: false, GetNonStreamUrl());

        using var response = await _httpClient.SendAsync(request, cancellationToken);
        if (!response.IsSuccessStatusCode)
        {
            var err = await response.Content.ReadAsStringAsync(cancellationToken);
            _logger.LogError("{Provider} API error: {Status} - {Content}", Provider, response.StatusCode, err);
            throw new InvalidOperationException($"{Provider} API returned {response.StatusCode}: {err}");
        }

        var json = await response.Content.ReadAsStringAsync(cancellationToken);
        await RecordUsageAsync(ExtractUsage(json), operation, streamed: false);

        var text = ExtractTextFromResponse(json);
        return cleanJson ? AiResponseParsing.CleanJsonResponse(text) : text.Trim();
    }

    // ── Provider-aware file core: streaming ──────────────────────────────

    private async IAsyncEnumerable<string> StreamFileTextAsync(
        byte[] fileData,
        string mimeType,
        string prompt,
        double temperature,
        int maxTokens,
        [EnumeratorCancellation] CancellationToken cancellationToken,
        [CallerMemberName] string operation = "")
    {
        await EnsureWithinQuotaAsync(cancellationToken);

        using var request = BuildFileRequest(fileData, mimeType, prompt, temperature, maxTokens, stream: true, GetStreamUrl());

        using var response = await _httpClient.SendAsync(request, HttpCompletionOption.ResponseHeadersRead, cancellationToken);
        if (!response.IsSuccessStatusCode)
        {
            var err = await response.Content.ReadAsStringAsync(cancellationToken);
            throw new InvalidOperationException($"{Provider} streaming API returned {response.StatusCode}: {err}");
        }

        var usage = new StreamUsageAccumulator();
        try
        {
            await foreach (var text in ReadSseAsync(response, usage, cancellationToken))
                yield return text;
        }
        finally
        {
            await RecordUsageAsync(usage.Result, operation, streamed: true);
        }
    }
}
