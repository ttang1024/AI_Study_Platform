using System.Net.Http.Headers;
using System.Runtime.CompilerServices;
using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Logging;

namespace StudyPlatform.Infrastructure.Services;

// Provider HTTP transport: request/response building, send & stream cores (text and file).
public partial class AiService
{
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
        return cleanJson ? AiResponseParsing.CleanJsonResponse(text) : text.Trim();
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
                ? (object)new { model = Model, max_tokens = maxTokens, system = systemPrompt, messages, temperature, stream }
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

    // ── Provider-aware multimodal core: streaming ─────────────────────────

    private async IAsyncEnumerable<string> StreamMultimodalTextAsync(
        string? systemPrompt,
        IEnumerable<(string role, string content)> history,
        string userMessage,
        IReadOnlyList<(byte[] data, string mimeType)> attachments,
        double temperature,
        int maxTokens,
        [EnumeratorCancellation] CancellationToken cancellationToken)
    {
        using var request = BuildMultimodalRequest(systemPrompt, history, userMessage, attachments, temperature, maxTokens, stream: true, GetStreamUrl());

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
        return cleanJson ? AiResponseParsing.CleanJsonResponse(text) : text.Trim();
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

}
