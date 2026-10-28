using StudyPlatform.Application.Common;
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
    // ── Send & stream cores ───────────────────────────────────────────────

    private UserFacingException TimedOut() => new(
        $"The AI provider ({Provider}) took longer than {(int)_requestTimeout.TotalSeconds} seconds to answer. "
            + "Try again, or try a shorter document or a faster model.",
        "AI_TIMEOUT",
        StatusCodesGatewayTimeout);

    private const int StatusCodesGatewayTimeout = 504;

    /// <summary>
    /// The one non-streaming round trip: send, fail loudly on a non-2xx, record the usage the body
    /// reports, and hand back the model's text.
    /// </summary>
    /// <param name="buildRequest">
    /// Deferred so the caller decides only the request shape — plain messages, a file, or a
    /// multimodal turn — and inherits everything else.
    /// </param>
    private async Task<string> SendAsync(
        Func<HttpRequestMessage> buildRequest,
        bool cleanJson,
        string operation,
        CancellationToken cancellationToken)
    {
        using var request = buildRequest();
        using var deadline = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
        deadline.CancelAfter(_requestTimeout);

        string json;
        try
        {
            using var response = await _httpClient.SendAsync(request, deadline.Token);
            if (!response.IsSuccessStatusCode)
            {
                var err = await response.Content.ReadAsStringAsync(deadline.Token);
                _logger.LogError("{Provider} API error: {Status} - {Content}", Provider, response.StatusCode, err);
                throw new AiProviderException($"{Provider} API returned {response.StatusCode}: {err}");
            }

            json = await response.Content.ReadAsStringAsync(deadline.Token);
        }
        catch (OperationCanceledException) when (!cancellationToken.IsCancellationRequested)
        {
            throw TimedOut();
        }
        await RecordUsageAsync(ExtractUsage(json), operation, streamed: false);

        var text = ExtractTextFromResponse(json);
        if (!cleanJson)
            return text.Trim();

        // Checked here, before any caller caches it: generated results are cached for 30 days, so a
        // truncated (max-tokens) or malformed answer that got through used to be served back on every
        // "please try again" — the retry never reached the model.
        var cleaned = AiResponseParsing.CleanJsonResponse(text);
        if (!AiResponseParsing.IsValidJson(cleaned))
        {
            _logger.LogWarning("{Provider} returned malformed JSON for {Operation} ({Length} chars)", Provider, operation, cleaned.Length);
            throw new UserFacingException(
                "The AI returned an incomplete or malformed answer. Please try again.", "AI_MALFORMED_RESPONSE", 502);
        }
        return cleaned;
    }

    /// <summary>
    /// The one streaming round trip. Usage is recorded in a <c>finally</c> so a consumer that
    /// abandons the enumeration mid-answer is still accounted for.
    /// </summary>
    private async IAsyncEnumerable<string> StreamAsync(
        Func<HttpRequestMessage> buildRequest,
        string operation,
        [EnumeratorCancellation] CancellationToken cancellationToken)
    {
        using var request = buildRequest();

        // The deadline covers only the wait for the provider to start answering; once tokens flow, a
        // long answer is fine (each chunk keeps the CDN connection alive).
        HttpResponseMessage response;
        using (var deadline = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken))
        {
            deadline.CancelAfter(_requestTimeout);
            try
            {
                response = await _httpClient.SendAsync(request, HttpCompletionOption.ResponseHeadersRead, deadline.Token);
            }
            catch (OperationCanceledException) when (!cancellationToken.IsCancellationRequested)
            {
                throw TimedOut();
            }
        }

        using var _ = response;
        if (!response.IsSuccessStatusCode)
        {
            var err = await response.Content.ReadAsStringAsync(cancellationToken);
            throw new AiProviderException($"{Provider} streaming API returned {response.StatusCode}: {err}");
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

    // ── Provider-agnostic cores ───────────────────────────────────────────

    private Task<string> SendTextAsync(
        string? systemPrompt,
        IEnumerable<(string role, string content)> messages,
        double temperature,
        int maxTokens,
        bool cleanJson,
        CancellationToken cancellationToken,
        [CallerMemberName] string operation = "")
        => SendAsync(
            () => BuildRequest(systemPrompt, messages, temperature, maxTokens, stream: false, GetNonStreamUrl()),
            cleanJson,
            operation,
            cancellationToken);

    private IAsyncEnumerable<string> StreamTextAsync(
        string? systemPrompt,
        IEnumerable<(string role, string content)> messages,
        double temperature,
        int maxTokens,
        CancellationToken cancellationToken,
        [CallerMemberName] string operation = "")
        => StreamAsync(
            () => BuildRequest(systemPrompt, messages, temperature, maxTokens, stream: true, GetStreamUrl()),
            operation,
            cancellationToken);

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
        var completed = false;

        while (true)
        {
            cancellationToken.ThrowIfCancellationRequested();
            var line = await ReadLineWithinIdleTimeoutAsync(reader, cancellationToken);
            if (line == null) break;
            if (!line.StartsWith("data: ")) continue;

            var data = line[6..].TrimEnd();
            if (data == "[DONE]")
            {
                completed = true;
                break;
            }
            if (string.IsNullOrEmpty(data)) continue;

            // Usage first, and outside the text try/catch: OpenAI-compatible providers deliver the
            // token counts in a trailing chunk that carries no text at all.
            usage.Observe(ExtractUsage(data));

            var (done, error) = ClassifyStreamFrame(data);
            if (error != null)
            {
                _logger.LogWarning("{Provider} stream reported an error: {Error}", Provider, error);
                throw new AiProviderException($"{Provider} streaming API returned an error: {error}");
            }
            completed |= done;

            string? text = null;
            try { text = ExtractChunkText(data); }
            catch { }

            if (!string.IsNullOrEmpty(text))
                yield return text;
        }

        // A body that simply ends — the provider or a proxy dropped the connection cleanly — used to
        // count as a finished answer, and the half summary was saved as the document's summary.
        if (!completed)
            throw new UserFacingException(
                "The AI response was cut off before it finished. Please try again.", "AI_STREAM_INTERRUPTED", 502);
    }

    private async Task<string?> ReadLineWithinIdleTimeoutAsync(StreamReader reader, CancellationToken cancellationToken)
    {
        using var idle = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
        idle.CancelAfter(_streamIdleTimeout);
        try
        {
            return await reader.ReadLineAsync(idle.Token);
        }
        catch (OperationCanceledException) when (!cancellationToken.IsCancellationRequested)
        {
            throw new UserFacingException(
                $"The AI provider ({Provider}) stopped responding mid-answer. Please try again.", "AI_TIMEOUT", StatusCodesGatewayTimeout);
        }
    }

    /// <summary>
    /// Whether a stream frame ends the answer, or reports a failure. Providers signal both in-band:
    /// Anthropic with <c>message_stop</c> / an <c>error</c> event, OpenAI-compatible APIs with a
    /// <c>finish_reason</c> (then <c>[DONE]</c>) or an <c>error</c> object, Gemini with a
    /// <c>finishReason</c> — where anything but STOP or MAX_TOKENS means the answer was withheld.
    /// </summary>
    private (bool Done, string? Error) ClassifyStreamFrame(string data)
    {
        JsonDocument doc;
        try { doc = JsonDocument.Parse(data); }
        catch (JsonException) { return (false, null); }

        using (doc)
        {
            var root = doc.RootElement;
            if (root.ValueKind != JsonValueKind.Object)
                return (false, null);

            if (root.TryGetProperty("error", out var error) && error.ValueKind != JsonValueKind.Null)
                return (false, ErrorMessage(error));

            if (Provider == "claude")
            {
                var type = root.TryGetProperty("type", out var t) ? t.GetString() : null;
                return type switch
                {
                    "message_stop" => (true, null),
                    "error" => (false, "stream error"),
                    _ => (false, null),
                };
            }

            if (!root.TryGetProperty("candidates", out _) && !root.TryGetProperty("choices", out _))
                return (false, null);

            var finish = Provider == "gemini"
                ? FirstProperty(root, "candidates", "finishReason")
                : FirstProperty(root, "choices", "finish_reason");
            if (finish == null)
                return (false, null);

            if (Provider == "gemini" && finish is not ("STOP" or "MAX_TOKENS"))
                return (false, $"answer withheld ({finish})");
            return (true, null);
        }

        static string? FirstProperty(JsonElement root, string array, string property)
            => root.TryGetProperty(array, out var items) && items.ValueKind == JsonValueKind.Array && items.GetArrayLength() > 0
               && items[0].TryGetProperty(property, out var value) && value.ValueKind == JsonValueKind.String
                ? value.GetString()
                : null;

        static string ErrorMessage(JsonElement error)
            => error.ValueKind == JsonValueKind.Object && error.TryGetProperty("message", out var m) && m.ValueKind == JsonValueKind.String
                ? m.GetString()!
                : error.ToString();
    }

    // ── Token accounting ──────────────────────────────────────────────────


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
        else if (IsGemini)
        {
            request.Headers.Add("x-goog-api-key", ApiKey);
        }
        else
        {
            request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", ApiKey);
        }

        return request;
    }

    // ── Response text extraction ──────────────────────────────────────────

    /// <summary>
    /// The answer text from a successful (2xx) response. Every step of the envelope is checked: a
    /// safety-blocked Gemini answer has no content, a refusal can come back with an empty content list,
    /// and a proxy can answer 200 with an HTML page. Walking the happy path with GetProperty and [0]
    /// turned those into KeyNotFoundException (which the API maps to 404 "Resource not found"),
    /// IndexOutOfRangeException or JsonException — anything but the AI error they are.
    /// </summary>
    private string ExtractTextFromResponse(string json)
    {
        JsonDocument doc;
        try
        {
            doc = JsonDocument.Parse(json);
        }
        catch (JsonException)
        {
            throw new AiProviderException($"{Provider} returned a response that is not JSON.");
        }

        using (doc)
        {
            var root = doc.RootElement;
            if (root.ValueKind != JsonValueKind.Object)
                throw new AiProviderException($"{Provider} returned an unexpected response.");

            var text = Provider switch
            {
                "gemini" => FirstOf(root, "candidates") is { } candidate
                    && candidate.TryGetProperty("content", out var content)
                    && FirstOf(content, "parts") is { } part
                    && part.TryGetProperty("text", out var t) ? t.GetString() : null,
                "claude" => FirstOf(root, "content") is { } block
                    && block.TryGetProperty("text", out var t2) ? t2.GetString() : null,
                _ => FirstOf(root, "choices") is { } choice
                    && choice.TryGetProperty("message", out var message)
                    && message.TryGetProperty("content", out var t3) ? t3.GetString() : null,
            };

            return text ?? throw new AiProviderException(NoAnswerMessage(root));
        }
    }

    /// <summary>Why a 2xx response carried no answer, in the provider's own terms where it gives one.</summary>
    private string NoAnswerMessage(JsonElement root)
    {
        var reason = Provider switch
        {
            "gemini" => FirstOf(root, "candidates") is { } c && c.TryGetProperty("finishReason", out var f) ? f.GetString()
                : root.TryGetProperty("promptFeedback", out var feedback) && feedback.TryGetProperty("blockReason", out var b) ? b.GetString()
                : null,
            "claude" => root.TryGetProperty("stop_reason", out var stop) && stop.ValueKind == JsonValueKind.String ? stop.GetString() : null,
            _ => FirstOf(root, "choices") is { } ch && ch.TryGetProperty("finish_reason", out var fr) && fr.ValueKind == JsonValueKind.String ? fr.GetString() : null,
        };
        return reason is null
            ? $"No response from {Provider}."
            : $"{Provider} returned no answer (finish reason: {reason}).";
    }

    private static JsonElement? FirstOf(JsonElement element, string arrayProperty)
        => element.ValueKind == JsonValueKind.Object
           && element.TryGetProperty(arrayProperty, out var array)
           && array.ValueKind == JsonValueKind.Array
           && array.GetArrayLength() > 0
            ? array[0]
            : null;

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

    // ── Provider-aware multimodal core: streaming ─────────────────────────

    private IAsyncEnumerable<string> StreamMultimodalTextAsync(
        string? systemPrompt,
        IEnumerable<(string role, string content)> history,
        string userMessage,
        IReadOnlyList<(byte[] data, string mimeType)> attachments,
        double temperature,
        int maxTokens,
        CancellationToken cancellationToken,
        [CallerMemberName] string operation = "")
        => StreamAsync(
            () => BuildMultimodalRequest(
                systemPrompt, history, userMessage, attachments, temperature, maxTokens, stream: true, GetStreamUrl()),
            operation,
            cancellationToken);

    // ── Provider-aware file cores ─────────────────────────────────────────

    private Task<string> CallAiWithFileAsync(byte[] fileData, string mimeType, string prompt, CancellationToken cancellationToken, bool cleanJson = true, [CallerMemberName] string operation = "")
        => SendFileTextAsync(fileData, mimeType, prompt, 0.7, 8192, cleanJson, cancellationToken, operation);

    private Task<string> SendFileTextAsync(
        byte[] fileData,
        string mimeType,
        string prompt,
        double temperature,
        int maxTokens,
        bool cleanJson,
        CancellationToken cancellationToken,
        [CallerMemberName] string operation = "")
        => SendAsync(
            () => BuildFileRequest(fileData, mimeType, prompt, temperature, maxTokens, stream: false, GetNonStreamUrl()),
            cleanJson,
            operation,
            cancellationToken);

    private IAsyncEnumerable<string> StreamFileTextAsync(
        byte[] fileData,
        string mimeType,
        string prompt,
        double temperature,
        int maxTokens,
        CancellationToken cancellationToken,
        [CallerMemberName] string operation = "")
        => StreamAsync(
            () => BuildFileRequest(fileData, mimeType, prompt, temperature, maxTokens, stream: true, GetStreamUrl()),
            operation,
            cancellationToken);
}
